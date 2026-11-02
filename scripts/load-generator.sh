#!/usr/bin/env bash
# Carga CONCURRENTE y constante contra la API durante el despliegue.
# Todas las peticiones entran por el ALB: es el ALB quien las reparte entre stable
# y canary segun el porcentaje de cada etapa, asi ambas versiones reciben la misma
# mezcla de peticiones al mismo tiempo (comparacion justa).
#
# Uso: load-generator.sh URL_BASE [RPS] [CONCURRENCIA] [ARCHIVO_RESUMEN]
#   RPS           peticiones por segundo objetivo (total)   [40]
#   CONCURRENCIA  trabajadores en paralelo                  [10]
# Se detiene con SIGTERM y entonces imprime un resumen.
set -u

BASE="${1:?Falta la URL base}"
RPS="${2:-40}"
CONC="${3:-10}"
SUMMARY="${4:-}"
PATHS=(/api/v2/products /api/v2/products /api/v2/products /api/v2/clients)

INTERVAL=$(awk -v c="$CONC" -v r="$RPS" 'BEGIN { printf "%.4f", c / r }')
TMP="$(mktemp -d)"
START_TS=$(date +%s)

worker() {
  local id="$1" begin elapsed wait code
  while true; do
    begin=$(date +%s.%N)
    code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "${BASE}${PATHS[$((RANDOM % ${#PATHS[@]}))]}" 2>/dev/null) || code=000
    echo "$code" >> "$TMP/w$id"
    elapsed=$(awk -v b="$begin" -v e="$(date +%s.%N)" 'BEGIN { printf "%.4f", e - b }')
    wait=$(awk -v i="$INTERVAL" -v e="$elapsed" 'BEGIN { w = i - e; if (w < 0) w = 0; printf "%.4f", w }')
    sleep "$wait"
  done
}

finish() {
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
  local secs=$(( $(date +%s) - START_TS ))
  local total ok
  total=$(cat "$TMP"/w* 2>/dev/null | wc -l)
  ok=$(cat "$TMP"/w* 2>/dev/null | grep -c '^2' || true)
  {
    echo "=== Carga generada: ${total} peticiones en ${secs} s (objetivo ${RPS}/s, ${CONC} en paralelo) ==="
    echo "    respuestas 2xx: ${ok}   no 2xx: $(( total - ok ))"
    echo "    por codigo HTTP:"
    cat "$TMP"/w* 2>/dev/null | sort | uniq -c | awk '{ printf "      %s: %s\n", $2, $1 }'
  } | tee ${SUMMARY:+"$SUMMARY"}
  rm -rf "$TMP"
  exit 0
}
trap finish TERM INT

for i in $(seq 1 "$CONC"); do
  worker "$i" &
  sleep "$(awk -v i="$INTERVAL" -v c="$CONC" 'BEGIN { printf "%.4f", i / c }')"  # escalona el arranque
done
wait
