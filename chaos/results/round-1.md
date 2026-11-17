# Ronda 1 del experimento de caos de ecommerce (16 de noviembre de 2026)

 Cifras de `chaos/results/stop-tasks/round-{0,1}/k6-summary.json` y de los diarios `journal-stop-tasks.json`.

**Mejora aplicada:** Número de tareas `desired_count` de 2 a 4. Mismo experimento (`stop-tasks`: se detiene el 50 % de las tareas, ahora 2 de 4), mismo perfil de carga y misma ruta (`/api/v1/products`) que la ronda 0. Umbral de la hipótesis revisada: `p(95) < 254 ms` (el p95 del estado estable de 2 tareas, 212 ms, más 20 %).

## 1. Comparación ronda 0 → ronda 1

| Métrica | Ronda 0 (2 tareas, se detiene 1) | Ronda 1 (4 tareas, se detienen 2) | Variación |
|---|---|---|---|
| Peticiones | 94 945 | 126 379 | +33,1 % |
| Throughput | 226,0 req/s | 300,8 req/s | +33,1 % |
| p50 | 75 ms | 54 ms | −28,2 % |
| p90 | 200 ms | 101 ms | −49,4 % |
| **p95** | **298 ms** | **195 ms** | **−34,7 %** |
| Máximo | 2 369 ms | 1 815 ms | −23,4 % |
| Peticiones fallidas | 0 | 10 | |
| Éxito | 100 % | 99,992 % | −0,008 puntos |
| **MTTR** (tareas en ejecución hasta `running = desired`) | **66 s** (1 → 2) | **86 s** (2 → 4) | **+30,3 %** (peor) |
| Estado estable de antes y de después | cumplido | cumplido (`running=4 desired=4`, alarma en `OK`) | |
| Hipótesis revisada (p95 ≤ 254 ms y MTTR ≤ 90 s) | se refuta (298 ms) | **se cumple** (195 ms y 86 s) | |

## 2. Lectura honesta de los resultados

- **Lo que mejoró:** el p95 baja de 298 a 195 ms (−34,7 %) y queda por debajo del umbral de 254 ms. Con 4 tareas, perder la mitad deja la misma capacidad que tenía el sistema en estado estable con 2, y se nota: el p95 de la ronda 1 (195 ms) es comparable al del estado estable de 2 tareas (207 a 213 ms).
- **Lo que empeoró:** el **MTTR sube de 66 a 86 s** (+30,3 %), porque ahora hay que reemplazar 2 tareas (`running=3` a los 65 s y `running=4` a los 86 s). Cumple el límite de 90 s, pero por **4 s de margen**.
- **Lo que no cambió:** el éxito sigue siendo prácticamente 100 %. Hubo 10 peticiones fallidas de 126 379 (0,008 %), del mismo orden que el estado estable de 2 tareas.

## 4. Hipótesis (resumen para el informe)
3
1. **Original** (`p(95) < 350 ms`, éxito ≥ 99 %): con el 50 % de tareas detenidas se **cumple** en la ronda 0 (298 ms, 100 %).
2. **Revisada** (p95 ≤ 254 ms y MTTR ≤ 90 s), **endurecida después de ver la ronda 0** porque el p95 había subido un 40,8 % y hubo un máximo de 2 369 ms: se **refuta** en la ronda 0 y se **cumple** en la ronda 1 (195 ms y 86 s).

## 5. Evidencia
4
`chaos/results/baseline/run-{1,2,3}/`, `chaos/results/stop-tasks/round-0/` y `round-1/` (cada una con `k6-summary.json` y `journal-stop-tasks.json`), y `round-0.md`.
