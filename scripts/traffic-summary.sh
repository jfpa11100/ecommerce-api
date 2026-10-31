#!/usr/bin/env bash
# Resume el CSV del sampler: reparto por track/version y evolucion por minuto.
CSV="${1:?Falta el CSV}"
[ -s "$CSV" ] || { echo "(sin muestras)"; exit 0; }
echo "=== Reparto total por track y version ==="
awk -F, 'NR>1{k=$4" ("$3")"; c[k]++; t++} END{for(k in c) printf "%-28s %6d  %5.1f%%\n", k, c[k], 100*c[k]/t}' "$CSV" | sort
echo
echo "=== Peticiones fallidas (http != 2xx) ==="
awk -F, 'NR>1 && $2 !~ /^2/{n++} END{print n+0" de "NR-1}' "$CSV"
echo
echo "=== Evolucion por minuto (% de respuestas del track canary) ==="
awk -F, 'NR>1{m=substr($1,1,16); t[m]++; if($4=="canary")c[m]++} END{for(m in t) printf "%s  canary=%5.1f%%  (%d muestras)\n", m, 100*c[m]/t[m], t[m]}' "$CSV" | sort
