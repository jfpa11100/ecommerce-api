#!/usr/bin/env bash
# Pruebas de humo de la ETAPA 0: se ejecutan contra el listener de pruebas
# (puerto 8080), cuando la revision nueva todavia NO recibe trafico publico.
# Termina con codigo 0 solo si todas las comprobaciones pasan.
set -euo pipefail

: "${TEST_URL:?Falta TEST_URL (p. ej. http://alb:8080)}"
: "${EXPECTED_VERSION:?Falta EXPECTED_VERSION}"
EXPECTED_TRACK="${EXPECTED_TRACK:-canary}"
TMP="$(mktemp -d)"
fail=0

ok() { echo "  OK     $*"; }
ko() { echo "  FALLO  $*" >&2; fail=1; }

curl_get() { # $1=url $2=archivo de cabeceras $3=archivo de cuerpo -> imprime el codigo HTTP
  curl -sS --max-time 15 --retry 6 --retry-delay 5 --retry-all-errors \
    -D "$2" -o "$3" -w '%{http_code}' "$1" 2>/dev/null || echo "000"
}
header() { grep -i "^$2:" "$1" | tail -1 | tr -d '\r' | sed -e 's/^[^:]*:[[:space:]]*//'; }

echo ">> Smoke tests en $TEST_URL (esperado: version=$EXPECTED_VERSION, track=$EXPECTED_TRACK)"

# 1) Salud
code=$(curl_get "$TEST_URL/health" "$TMP/h1" "$TMP/b1")
[ "$code" = "200" ] && ok "/health -> 200" || ko "/health -> $code"

# 2) La instancia que responde es la revision nueva
code=$(curl_get "$TEST_URL/version" "$TMP/h2" "$TMP/b2")
if [ "$code" = "200" ]; then
  ver=$(jq -r '.version // empty' "$TMP/b2" 2>/dev/null || true)
  trk=$(jq -r '.track // empty' "$TMP/b2" 2>/dev/null || true)
  apis=$(jq -r '(.apiVersions // []) | join(",")' "$TMP/b2" 2>/dev/null || true)
  [ "$ver" = "$EXPECTED_VERSION" ] && ok "/version.version = $ver" || ko "/version.version = '$ver' (esperado $EXPECTED_VERSION)"
  [ "$trk" = "$EXPECTED_TRACK" ] && ok "/version.track = $trk" || ko "/version.track = '$trk' (esperado $EXPECTED_TRACK)"
  case ",$apis," in *,v3,*) ok "apiVersions incluye v3 ($apis)";; *) ko "apiVersions no incluye v3 ($apis)";; esac
else
  ko "/version -> $code"
fi

# 3) v3: responde, trae cabeceras de trazabilidad y expone el cambio (category)
code=$(curl_get "$TEST_URL/api/v3/products" "$TMP/h3" "$TMP/b3")
if [ "$code" = "200" ]; then
  ok "/api/v3/products -> 200 (la migracion Expand esta aplicada)"
  [ "$(header "$TMP/h3" x-app-version)" = "$EXPECTED_VERSION" ] && ok "X-App-Version correcto" || ko "X-App-Version incorrecto en /api/v3/products"
  [ "$(header "$TMP/h3" x-app-track)" = "$EXPECTED_TRACK" ] && ok "X-App-Track correcto" || ko "X-App-Track incorrecto en /api/v3/products"
  if jq -e 'type=="array"' "$TMP/b3" >/dev/null 2>&1; then
    n=$(jq 'length' "$TMP/b3")
    if [ "$n" -gt 0 ]; then
      jq -e 'all(.[]; has("category"))' "$TMP/b3" >/dev/null 2>&1 \
        && ok "v3 expone 'category' en los $n productos" || ko "v3 NO expone 'category' en todos los productos"
    else
      echo "  AVISO  no hay productos: no se puede comprobar 'category'"
    fi
  else
    ko "/api/v3/products no devolvio un arreglo JSON"
  fi
else
  ko "/api/v3/products -> $code"
fi

# 4) Compatibilidad hacia atras: v2 sigue igual en la revision nueva (sin 'category')
code=$(curl_get "$TEST_URL/api/v2/products" "$TMP/h4" "$TMP/b4")
if [ "$code" = "200" ]; then
  ok "/api/v2/products -> 200"
  if jq -e 'type=="array" and length>0' "$TMP/b4" >/dev/null 2>&1; then
    jq -e 'all(.[]; has("category") | not)' "$TMP/b4" >/dev/null 2>&1 \
      && ok "v2 conserva su contrato (sin 'category')" || ko "v2 cambio su contrato: aparece 'category'"
  fi
else
  ko "/api/v2/products -> $code"
fi

rm -rf "$TMP"
if [ "$fail" -eq 0 ]; then echo ">> Smoke tests: TODOS OK"; else echo ">> Smoke tests: HAY FALLOS" >&2; fi
exit "$fail"
