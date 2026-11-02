"""Pruebas del quality gate. Se ejecutan con:  python3 -m unittest discover -s scripts/tests -v"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import slo_gate  # noqa: E402

SLO_PATH = os.environ.get(
    "SLO_FILE", os.path.join(os.path.dirname(__file__), "..", "..", "slo", "canary-slo.yaml"))


def track(req=500, err=0, p95=100.0, cpu=20.0, mem=30.0, listed=0, low=0, **extra):
    return {"req": req, "err5xx": err, "err4xx": 0, "p50": p95 / 2, "p95": p95, "p99": p95 * 1.5,
            "listed": listed, "lowstock": low, "cpu_max": cpu, "mem_max": mem, **extra}


class DecideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.slo = slo_gate.load_slo(SLO_PATH)

    def decide(self, stable, canary, **kw):
        return slo_gate.decide(self.slo, {"stable": stable, "canary": canary}, **kw)

    def test_canary_sano_se_promueve(self):
        out = self.decide(track(err=2, p95=100), track(req=450, err=2, p95=110))
        self.assertEqual(out["decision"], "PROMOTE")

    def test_pocas_muestras_del_canary_pausa(self):
        out = self.decide(track(), track(req=120))
        self.assertEqual(out["decision"], "PAUSE")
        self.assertIn("muestras insuficientes del canary", out["pause_reasons"][0])

    def test_pocas_muestras_de_stable_pausa(self):
        out = self.decide(track(req=50), track(req=400))
        self.assertEqual(out["decision"], "PAUSE")
        self.assertTrue(any("stable" in r for r in out["pause_reasons"]))

    def test_error_5xx_alto_aborta(self):
        out = self.decide(track(), track(req=400, err=120))  # 30 %
        self.assertEqual(out["decision"], "ABORT")
        self.assertTrue(any("5xx" in r for r in out["abort_reasons"]))

    def test_error_5xx_en_franja_intermedia_pausa(self):
        out = self.decide(track(), track(req=400, err=12))  # 3 %: > 1 % (pausa) y < 5 % (abortar)
        self.assertEqual(out["decision"], "PAUSE")

    def test_error_5xx_por_encima_de_stable_aborta(self):
        out = self.decide(track(req=500, err=0), track(req=400, err=16))  # 4 %: abs < 5 %, pero +4 pts vs stable
        self.assertEqual(out["decision"], "ABORT")
        self.assertTrue(any("supera a stable" in r for r in out["abort_reasons"]))

    def test_latencia_absoluta_aborta(self):
        out = self.decide(track(p95=900), track(req=400, p95=1500))
        self.assertEqual(out["decision"], "ABORT")

    def test_latencia_relativa_aborta(self):
        out = self.decide(track(p95=100), track(req=400, p95=250))  # 2.5x stable, < 1000 ms
        self.assertEqual(out["decision"], "ABORT")

    def test_latencia_relativa_en_franja_intermedia_pausa(self):
        out = self.decide(track(p95=100), track(req=400, p95=150))  # 1.5x: > 1.3x y < 2x
        self.assertEqual(out["decision"], "PAUSE")

    def test_saturacion_aborta_aunque_haya_pocas_muestras(self):
        out = self.decide(track(), track(req=10, cpu=95.0))
        self.assertEqual(out["decision"], "ABORT")
        self.assertTrue(any("CPU" in r for r in out["abort_reasons"]))

    def test_metrica_de_negocio_desviada_pausa(self):
        out = self.decide(track(listed=1000, low=100), track(req=400, listed=1000, low=400))  # 10 % vs 40 %
        self.assertEqual(out["decision"], "PAUSE")
        self.assertTrue(any("stock bajo" in r for r in out["pause_reasons"]))

    def test_al_100_por_ciento_solo_umbrales_absolutos(self):
        # stable ya no recibe trafico: no se exige muestra de stable ni se compara
        out = self.decide(track(req=0, p95=0), track(req=900, err=1, p95=300))
        self.assertEqual(out["decision"], "PROMOTE")
        out = self.decide(track(req=0, p95=0), track(req=900, err=90, p95=300))  # 10 %
        self.assertEqual(out["decision"], "ABORT")

    def test_primera_pausa_sin_trafico_real_promueve(self):
        out = self.decide(track(req=600), track(req=8), allow_no_traffic=True)  # solo humo de la Etapa 0
        self.assertEqual(out["decision"], "PROMOTE")
        self.assertIn("aun no recibe", out["note"])

    def test_allow_no_traffic_no_exime_con_un_primer_paso_ya_aplicado(self):
        # 10 % del trafico: ya es un paso real, hay que evaluar (aqui faltan muestras de canary)
        out = self.decide(track(req=3600), track(req=200), allow_no_traffic=True)
        self.assertEqual(out["decision"], "PAUSE")

    def test_sin_allow_no_traffic_un_canary_sin_trafico_pausa(self):
        out = self.decide(track(req=600), track(req=8))
        self.assertEqual(out["decision"], "PAUSE")

    def test_allow_no_traffic_no_exime_si_ya_hay_trafico(self):
        out = self.decide(track(req=500), track(req=400, err=120), allow_no_traffic=True)
        self.assertEqual(out["decision"], "ABORT")

    def test_pausa_prolongada_se_convierte_en_abortar(self):
        out = self.decide(track(), track(req=120), paused_minutes=11)
        self.assertEqual(out["decision"], "ABORT")
        self.assertTrue(any("maximo" in r for r in out["abort_reasons"]))

    def test_abortar_gana_a_pausar(self):
        out = self.decide(track(), track(req=100, cpu=99.0))  # faltan muestras Y hay saturacion
        self.assertEqual(out["decision"], "ABORT")


class MeasureTests(unittest.TestCase):
    ROWS = [
        [{"field": "Track", "value": "canary"}, {"field": "req", "value": "400"}, {"field": "err5xx", "value": "8"},
         {"field": "p95", "value": "123.4"}, {"field": "cpu_max", "value": "41.2"}, {"field": "@ptr", "value": "x"}],
        [{"field": "Track", "value": "stable"}, {"field": "req", "value": "3600"}, {"field": "listed", "value": ""}],
        [{"field": "req", "value": "7"}],  # fila sin Track: se ignora
    ]

    def test_parse_results(self):
        stats = slo_gate.parse_results(self.ROWS)
        self.assertEqual(set(stats), {"canary", "stable"})
        self.assertEqual(stats["canary"]["req"], 400.0)
        self.assertEqual(stats["canary"]["p95"], 123.4)
        self.assertEqual(stats["stable"]["listed"], 0.0)  # vacio -> 0

    def test_query_window_espera_a_que_complete(self):
        calls = []
        replies = iter([{"queryId": "q1"}, {"status": "Running"}, {"status": "Complete", "results": self.ROWS}])

        def runner(args, region):
            calls.append(args)
            return next(replies)

        orig_sleep = slo_gate.time.sleep
        slo_gate.time.sleep = lambda s: None
        try:
            stats = slo_gate.query_window("/ecs/app", "us-east-2", 2, runner=runner, now=1_000_000)
        finally:
            slo_gate.time.sleep = orig_sleep
        self.assertEqual(stats["stable"]["req"], 3600.0)
        start = calls[0]
        self.assertEqual(start[start.index("--start-time") + 1], "999880")  # ventana de 2 min
        self.assertEqual(start[start.index("--end-time") + 1], "1000000")

    def test_consulta_fallida_lanza_error(self):
        replies = iter([{"queryId": "q1"}, {"status": "Failed"}])
        with self.assertRaises(RuntimeError):
            slo_gate.query_window("/ecs/app", "r", 2, runner=lambda a, r: next(replies), now=1)


class MainLoopTests(unittest.TestCase):
    """Bucle completo con medidas simuladas: pausa y luego promueve / aborta."""

    def run_main(self, sequences, **kw):
        """sequences: lista de dict {stable:..., canary:...} que devuelve cada medicion"""
        seq = iter(sequences)
        orig = slo_gate.query_window
        slo_gate.query_window = lambda *a, **k: next(seq)
        sleeps = []
        out_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl")
        out_file.close()
        try:
            code = slo_gate.main(["--slo", SLO_PATH, "--log-group", "/ecs/x", "--region", "r",
                                  "--label", "prueba", "--decisions-file", out_file.name, "--poll-seconds", "5"],
                                 sleep=sleeps.append, clock=kw.get("clock", lambda: 0))
        finally:
            slo_gate.query_window = orig
        with open(out_file.name, encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh]
        os.unlink(out_file.name)
        return code, rows, sleeps

    def test_pausa_y_luego_promueve(self):
        code, rows, sleeps = self.run_main([
            {"stable": track(), "canary": track(req=100)},     # faltan muestras -> PAUSA
            {"stable": track(), "canary": track(req=450)},     # ya hay muestras -> PROMUEVE
        ])
        self.assertEqual(code, slo_gate.EXIT_PROMOTE)
        self.assertEqual([r["decision"] for r in rows], ["PAUSE", "PROMOTE"])
        self.assertEqual(sleeps, [5])

    def test_aborta_con_regresion(self):
        code, rows, _ = self.run_main([{"stable": track(), "canary": track(req=400, err=150)}])
        self.assertEqual(code, slo_gate.EXIT_ABORT)
        self.assertEqual(rows[0]["decision"], "ABORT")
        self.assertEqual(rows[0]["stage"], "prueba")

    def test_pausa_eterna_termina_en_abortar(self):
        ticks = iter(range(0, 10_000, 120))  # cada llamada al reloj avanza 2 min
        code, rows, _ = self.run_main([{"stable": track(), "canary": track(req=50)}] * 20,
                                      clock=lambda: next(ticks))
        self.assertEqual(code, slo_gate.EXIT_ABORT)
        self.assertEqual(rows[-1]["decision"], "ABORT")

    def test_sin_medidas_fiables_devuelve_error(self):
        def boom(*a, **k):
            raise RuntimeError("sin acceso a CloudWatch")
        orig = slo_gate.query_window
        slo_gate.query_window = boom
        try:
            code = slo_gate.main(["--slo", SLO_PATH, "--log-group", "/ecs/x", "--region", "r"],
                                 sleep=lambda s: None, clock=lambda: 0)
        finally:
            slo_gate.query_window = orig
        self.assertEqual(code, slo_gate.EXIT_ERROR)


if __name__ == "__main__":
    unittest.main()
