#!/usr/bin/env python3
"""Quality gate del despliegue canary (puerta de analisis automatico).

Lee los umbrales de slo/canary-slo.yaml, mide stable y canary en la MISMA
ventana (consultando los logs EMF de la API con CloudWatch Logs Insights) y decide:

    PROMOVER -> exit 0   (se puede avanzar a la siguiente etapa)
    ABORTAR  -> exit 10  (rollback inmediato: 0% canary / 100% stable)
    PAUSAR   -> no sale: sigue midiendo hasta promover, abortar o agotar max_pause_minutes
    (si no puede medir -> exit 11, que el pipeline trata como ABORTAR: nunca se promueve a ciegas)

Se usa Logs Insights y no las metricas de CloudWatch porque los logs estan
disponibles en segundos y permiten un percentil exacto sobre la ventana completa.
Son los mismos datos EMF que alimentan el dashboard.
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone

import yaml

EXIT_PROMOTE, EXIT_ABORT, EXIT_ERROR = 0, 10, 11
NO_TRAFFIC_SHARE_PCT = 2.0

QUERY = (
    "filter ispresent(Track) "
    "| stats count(Requests) as req, sum(Http5xx) as err5xx, sum(Http4xx) as err4xx, "
    "pct(LatencyMs, 50) as p50, pct(LatencyMs, 95) as p95, pct(LatencyMs, 99) as p99, "
    "sum(ProductsListed) as listed, sum(LowStockProductsListed) as lowstock, "
    "max(CpuPercent) as cpu_max, max(MemoryPercent) as mem_max by Track"
)

FIELDS = ("req", "err5xx", "err4xx", "p50", "p95", "p99", "listed", "lowstock", "cpu_max", "mem_max")


def load_slo(path):
    with open(path, encoding="utf-8") as fh:
        slo = yaml.safe_load(fh)
    for key in ("sampling", "decision"):
        if key not in slo:
            raise ValueError(f"El SLO no tiene la seccion '{key}'")
    return slo


def empty_stats():
    return {f: 0.0 for f in FIELDS}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_results(rows):
    """Resultado de get-query-results -> {track: {campo: numero}}"""
    stats = {}
    for row in rows:
        record = {cell["field"]: cell.get("value") for cell in row}
        track = record.get("Track")
        if not track:
            continue
        stats[track] = {f: _num(record.get(f)) for f in FIELDS}
    return stats


def run_aws(args, region):
    proc = subprocess.run(["aws", *args, "--region", region, "--output", "json"],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "fallo el comando aws")
    return json.loads(proc.stdout) if proc.stdout.strip() else {}


def query_window(log_group, region, window_minutes, runner=run_aws, now=None, timeout=90):
    """Ejecuta la consulta de Logs Insights sobre los ultimos window_minutes."""
    end = int(now if now is not None else time.time())
    start = end - int(window_minutes * 60)
    started = runner(["logs", "start-query", "--log-group-name", log_group,
                      "--start-time", str(start), "--end-time", str(end),
                      "--query-string", QUERY], region)
    query_id = started["queryId"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        res = runner(["logs", "get-query-results", "--query-id", query_id], region)
        status = res.get("status")
        if status == "Complete":
            return parse_results(res.get("results", []))
        if status in ("Failed", "Cancelled", "Timeout"):
            raise RuntimeError(f"La consulta de Logs Insights termino en estado {status}")
        time.sleep(2)
    raise RuntimeError("Tiempo agotado esperando la consulta de Logs Insights")


def pct_of(part, whole):
    return 100.0 * part / whole if whole else 0.0


def decide(slo, stats, paused_minutes=0.0, allow_no_traffic=False):
    """Funcion pura: (SLO + medidas) -> decision. Facil de probar sin AWS."""
    smp, dec = slo["sampling"], slo["decision"]
    abort_t, pause_t = dec["abort"], dec["pause"]
    min_req = smp["min_requests_per_track"]

    c = {**empty_stats(), **stats.get("canary", {})}
    s = {**empty_stats(), **stats.get("stable", {})}
    total = c["req"] + s["req"]
    share = pct_of(c["req"], total)
    c_err, s_err = pct_of(c["err5xx"], c["req"]), pct_of(s["err5xx"], s["req"])
    c_low, s_low = pct_of(c["lowstock"], c["listed"]), pct_of(s["lowstock"], s["listed"])

    measured = {
        "canary_share_pct": round(share, 1),
        "requests": {"stable": int(s["req"]), "canary": int(c["req"])},
        "err5xx_pct": {"stable": round(s_err, 2), "canary": round(c_err, 2)},
        "p95_ms": {"stable": round(s["p95"], 1), "canary": round(c["p95"], 1)},
        "cpu_max_pct": {"canary": round(c["cpu_max"], 1)},
        "mem_max_pct": {"canary": round(c["mem_max"], 1)},
        "low_stock_pct": {"stable": round(s_low, 1), "canary": round(c_low, 1)},
    }

    def result(decision, abort=(), pause=(), note=None):
        return {"decision": decision, "abort_reasons": list(abort), "pause_reasons": list(pause),
                "note": note, "measured": measured}

    # Antes del primer paso de trafico real el canary solo tiene las peticiones de humo de la
    # Etapa 0 (<2 % del total, muy por debajo del primer paso): no hay nada que evaluar aun.
    if allow_no_traffic and share < NO_TRAFFIC_SHARE_PCT and s["req"] >= min_req:
        return result("PROMOTE", note="el canary aun no recibe trafico de produccion")

    # Al llegar al 100% ya no hay trafico en stable: solo se aplican umbrales absolutos
    stable_traffic = share < 99.0
    enough_c = c["req"] >= min_req
    enough_s = (s["req"] >= min_req) if stable_traffic else True
    can_compare = stable_traffic and enough_s and enough_c

    abort, pause = [], []

    # Saturacion: se evalua siempre (no depende del numero de peticiones)
    if c["cpu_max"] > abort_t["cpu_pct"]:
        abort.append(f"CPU del canary {c['cpu_max']:.1f}% > {abort_t['cpu_pct']}%")
    if c["mem_max"] > abort_t["memory_pct"]:
        abort.append(f"memoria del canary {c['mem_max']:.1f}% > {abort_t['memory_pct']}%")

    if enough_c:
        if c_err > abort_t["error_rate_5xx_pct"]:
            abort.append(f"5xx del canary {c_err:.2f}% > {abort_t['error_rate_5xx_pct']}%")
        if c["p95"] > abort_t["latency_p95_ms"]:
            abort.append(f"p95 del canary {c['p95']:.0f} ms > {abort_t['latency_p95_ms']} ms")
        if can_compare:
            if c_err - s_err > abort_t["error_rate_5xx_delta_pct"]:
                abort.append(f"5xx del canary {c_err:.2f}% supera a stable ({s_err:.2f}%) en mas de "
                             f"{abort_t['error_rate_5xx_delta_pct']} puntos")
            if s["p95"] > 0 and c["p95"] > s["p95"] * abort_t["latency_p95_ratio_vs_stable"]:
                abort.append(f"p95 del canary {c['p95']:.0f} ms > {abort_t['latency_p95_ratio_vs_stable']}x "
                             f"el de stable ({s['p95']:.0f} ms)")

    if not enough_c:
        pause.append(f"muestras insuficientes del canary: {int(c['req'])} < {min_req} peticiones")
    if stable_traffic and not enough_s:
        pause.append(f"muestras insuficientes de stable: {int(s['req'])} < {min_req} peticiones")
    if enough_c:
        if c_err > pause_t["error_rate_5xx_pct"]:
            pause.append(f"5xx del canary {c_err:.2f}% > {pause_t['error_rate_5xx_pct']}%")
        if can_compare and s["p95"] > 0 and c["p95"] / s["p95"] > pause_t["latency_p95_ratio_vs_stable"]:
            pause.append(f"p95 del canary {c['p95']:.0f} ms es {c['p95'] / s['p95']:.2f}x el de stable "
                         f"(umbral {pause_t['latency_p95_ratio_vs_stable']}x)")
        if can_compare and c["listed"] > 0 and s["listed"] > 0 and \
                abs(c_low - s_low) > pause_t["low_stock_ratio_delta_pct"]:
            pause.append(f"metrica de negocio: stock bajo {c_low:.1f}% (canary) vs {s_low:.1f}% (stable), "
                         f"desviacion > {pause_t['low_stock_ratio_delta_pct']} puntos")

    if abort:
        return result("ABORT", abort, pause)
    if pause:
        if paused_minutes >= dec["max_pause_minutes"]:
            return result("ABORT", [f"la etapa lleva {paused_minutes:.0f} min en pausa "
                                    f"(maximo {dec['max_pause_minutes']} min)"], pause)
        return result("PAUSE", pause=pause)
    return result("PROMOTE")


def format_report(label, outcome):
    m = outcome["measured"]
    lines = [
        f"----- QUALITY GATE | {label} -----",
        f"  trafico del canary: {m['canary_share_pct']}%   peticiones  stable={m['requests']['stable']}  canary={m['requests']['canary']}",
        f"  5xx %:     stable={m['err5xx_pct']['stable']}   canary={m['err5xx_pct']['canary']}",
        f"  p95 ms:    stable={m['p95_ms']['stable']}   canary={m['p95_ms']['canary']}",
        f"  CPU max %: canary={m['cpu_max_pct']['canary']}   memoria max %: canary={m['mem_max_pct']['canary']}",
        f"  stock bajo %: stable={m['low_stock_pct']['stable']}   canary={m['low_stock_pct']['canary']}",
        f"  DECISION: {outcome['decision']}",
    ]
    for r in outcome["abort_reasons"]:
        lines.append(f"    - ABORTAR: {r}")
    for r in outcome["pause_reasons"]:
        lines.append(f"    - pausar:  {r}")
    if outcome.get("note"):
        lines.append(f"    - nota: {outcome['note']}")
    return "\n".join(lines)


def record_decision(path, label, outcome):
    if not path:
        return
    row = {"ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "stage": label, **outcome}
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def main(argv=None, runner=run_aws, sleep=time.sleep, clock=time.time):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slo", required=True)
    ap.add_argument("--log-group", required=True)
    ap.add_argument("--region", required=True)
    ap.add_argument("--label", default="etapa")
    ap.add_argument("--allow-no-traffic", action="store_true",
                    help="primera pausa: promueve si el canary aun no recibe trafico real")
    ap.add_argument("--poll-seconds", type=int, default=20)
    ap.add_argument("--decisions-file", default="")
    args = ap.parse_args(argv)

    slo = load_slo(args.slo)
    window = slo["sampling"]["window_minutes"]
    started = clock()
    failures = 0

    while True:
        try:
            stats = query_window(args.log_group, args.region, window, runner=runner)
            failures = 0
        except Exception as exc:  # noqa: BLE001 - cualquier fallo de medicion
            failures += 1
            print(f"[gate] no se pudo medir ({failures}/3): {exc}", file=sys.stderr)
            if failures >= 3:
                print("[gate] sin medidas fiables: se trata como ABORTAR (no se promueve a ciegas)", file=sys.stderr)
                return EXIT_ERROR
            sleep(10)
            continue

        paused = (clock() - started) / 60.0
        outcome = decide(slo, stats, paused_minutes=paused, allow_no_traffic=args.allow_no_traffic)
        print(format_report(args.label, outcome), flush=True)
        record_decision(args.decisions_file, args.label, outcome)

        if outcome["decision"] == "PROMOTE":
            return EXIT_PROMOTE
        if outcome["decision"] == "ABORT":
            return EXIT_ABORT
        print(f"[gate] PAUSA: se vuelve a medir en {args.poll_seconds} s ...", flush=True)
        sleep(args.poll_seconds)


if __name__ == "__main__":
    sys.exit(main())
