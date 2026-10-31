#!/usr/bin/env bash
# Muestrea una URL en bucle y registra que version/track/instancia respondio.
# Uso: traffic-sampler.sh URL ARCHIVO_CSV [segundos_entre_peticiones]
URL="${1:?Falta la URL}"; OUT="${2:?Falta el archivo de salida}"; INTERVAL="${3:-1}"
echo "ts,http,version,track,instance" > "$OUT"
while true; do
  resp=$(curl -s -o /dev/null -D - -m 5 -w 'HTTPCODE:%{http_code}' "$URL" 2>/dev/null | tr -d '\r' || true)
  code=$(printf '%s\n' "$resp" | sed -n 's/.*HTTPCODE:\([0-9]*\).*/\1/p' | tail -1)
  ver=$(printf '%s\n' "$resp" | awk -F': *' 'tolower($1)=="x-app-version"{print $2; exit}')
  trk=$(printf '%s\n' "$resp" | awk -F': *' 'tolower($1)=="x-app-track"{print $2; exit}')
  ins=$(printf '%s\n' "$resp" | awk -F': *' 'tolower($1)=="x-app-instance"{print $2; exit}')
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ),${code:-000},${ver:--},${trk:--},${ins:--}" >> "$OUT"
  sleep "$INTERVAL"
done
