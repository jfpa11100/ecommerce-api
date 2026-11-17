# Ronda 0 del experimento de caos de ecommerce (16 de noviembre de 2026)

> Todas las cifras salen de los `k6-summary.json` y del `journal-stop-tasks.json` de `chaos/results/`.

**Fallo inyectado (F2):** se detiene el 50 % de las tareas ECS del servicio (1 de 2) mientras corre la carga sostenida. Herramienta: Chaos Toolkit (`chaos/experiments/stop-tasks.json`) lanzado desde el workflow `Chaos experiment`. Radio de impacto: el servicio ECS de ecommerce, datos sintéticos, carga máxima de 30 usuarios virtuales. Aborto: alarma `ecommerce-api-dev-chaos-abort` (5xx del balanceador) y los umbrales de k6.

**Perfil de carga (k6):** el del grupo, 5, 15 y 30 usuarios de 60 s y 30 sostenidos, contra `/api/v1/products`. Mismo perfil en el estado estable y en la ronda 0.

## 1. Estado estable (3 corridas, workflow `baseline`)

| Corrida | Peticiones | Throughput | p50 | p90 | **p95** | Máximo | Peticiones fallidas | Éxito |
|---|---|---|---|---|---|---|---|---|
| 1 | 95 785 | 228,0 req/s | 80 ms | 141 ms | **207 ms** | 1 003 ms | 13 | 99,986 % |
| 2 | 124 522 | 296,4 req/s | 22 ms | 184 ms | **212 ms** | 805 ms | 3 | 99,998 % |
| 3 | 99 635 | 237,1 req/s | 61 ms | 159 ms | **213 ms** | 794 ms | 18 | 99,982 % |
| **Mediana** | | 237,1 req/s | 61 ms | 159 ms | **212 ms** | 805 ms | | **99,986 %** |

El p95 es muy estable (207 a 213 ms). El p50 varía más entre corridas (22 a 80 ms), por eso la métrica del experimento es el **p95**. Hubo entre 3 y 18 peticiones fallidas por corrida (0,01 % a 0,02 %): **[Pipe: explicar la causa con el `k6.log` de cada corrida, por ejemplo si ocurrieron en la rampa]**.

## 2. Ronda 0: comparación con el estado estable

| Métrica | Estado estable (mediana) | Ronda 0 (50 % de tareas detenidas) | Variación |
|---|---|---|---|
| Peticiones | 99 635 | 94 945 | −4,7 % |
| Throughput | 237,1 req/s | 226,0 req/s | −4,7 % |
| p50 | 61 ms | 75 ms | +23,0 % |
| p90 | 159 ms | 200 ms | +25,6 % |
| **p95** | **212 ms** | **298 ms** | **+40,8 %** |
| Máximo | 805 ms | 2 369 ms | +194,2 % |
| Éxito | 99,986 % | **100 %** | +0,014 puntos |
| Peticiones fallidas | 3 a 18 | 0 | |
| **MTTR** (tareas en ejecución 1 → 2 de 2) | | **66 s** | |

Cronología del MTTR (`journal-stop-tasks.json`, hora UTC): tarea detenida a las 23:54:59; `running=1 desired=2` a los 1, 12, 23, 34, 44 y 55 s; `running=2 desired=2` a los **66 s** (23:56:11). El estado estable de antes y de después del experimento se cumplió (`health` 200, `running=2 desired=2`, alarma en `OK`). La alarma de aborto no sonó.

## 3. Hipótesis

**Hipótesis original** (umbral `p(95) < 350 ms` y éxito ≥ 99 %, derivado de la mediana del p95 × 1,5): con el 50 % de las tareas detenidas durante la carga sostenida, el flujo mantiene éxito ≥ 99 % y p95 ≤ 350 ms.
- Resultado: éxito 100 % y p95 de 298 ms → **la hipótesis se cumple**. No se refutó.

**Hipótesis revisada** (se endureció **después** de ver los resultados de la ronda 0; se declara así para no ocultarlo): con el 50 % de las tareas detenidas, el p95 no se degrada más de un 20 % respecto al estado estable (≤ 254 ms) y el MTTR es de 90 s o menos.
- Motivo: aunque el éxito no cayó, el p95 sube un 40,8 % y aparece un máximo de 2 369 ms; un presupuesto de degradación del 20 % es más cercano a lo que espera un usuario que el 50 % implícito del umbral original.
- Resultado en la ronda 0: p95 de 298 ms (+40,8 %) → **se refuta**; MTTR de 66 s → cumple.
## 4. Modo de fallo y diagnóstico

La falla **no produce errores**: el balanceador saca la tarea detenida y la tarea que queda atiende todo, así que el éxito se mantiene en 100 %. Lo que se degrada es la **latencia**: con una sola tarea de 256 de CPU y 512 de memoria la capacidad se reduce a la mitad durante unos 66 s y el p95 sube un 40,8 %.**


## 5. Mejora propuesta para la ronda 1

`desired_count` de 2 a 4: al detener el 50 % quedan 2 tareas, la misma capacidad que el estado estable de hoy.
- Como la capacidad base cambia, **hay que medir de nuevo el estado estable con 4 tareas** (al menos una corrida del workflow `baseline`) antes de la ronda 1.
- Costo: el doble de tareas de Fargate por hora, que se declara en el informe.
- Límite: no protege contra la pérdida de ambas zonas de disponibilidad.

| Métrica | Estado estable con 4 tareas | Ronda 0 | Ronda 1 | Variación 0 → 1 |
|---|---|---|---|---|
| p95 | *pendiente* | 298 ms | *pendiente* | *pendiente* |
| Éxito | *pendiente* | 100 % | *pendiente* | |
| MTTR | | 66 s | *pendiente* | *pendiente* |
| Hipótesis revisada (p95 ≤ +20 %, MTTR ≤ 90 s) | | se refuta | *pendiente* | |

Si la ronda 1 no cumple la hipótesis, se reporta así y se explica.

## 6. Evidencia

`chaos/results/baseline/run-{1,2,3}/k6-summary.json`, `chaos/results/stop-tasks/k6-summary.json`, `chaos/results/stop-tasks/journal-stop-tasks.json`.
