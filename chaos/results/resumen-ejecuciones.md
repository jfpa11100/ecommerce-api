# Resultados del experimento de caos de ecommerce


**Fallo (F2):** se detiene el 50 % de las tareas ECS del servicio mientras corre la carga sostenida (Chaos Toolkit, `chaos/experiments/stop-tasks.json`). **Carga:** perfil del grupo (5, 15 y 30 usuarios de 60 s y 30 sostenidos) contra `/api/v1/products`, el mismo en todas las corridas. **Radio de impacto:** el servicio ECS de ecommerce, datos sintéticos, máximo 30 usuarios virtuales. **Aborto:** alarma `ecommerce-api-dev-chaos-abort` y umbrales de k6.

## 1. Todas las corridas

| Grupo | Corrida | Peticiones | Throughput | p50 | p90 | **p95** | Máximo | Fallidas | Éxito |
|---|---|---|---|---|---|---|---|---|---|
| Estado estable, 2 tareas | 1 | 95 785 | 228 req/s | 80 ms | 141 ms | **207 ms** | 1 003 ms | 13 | 99,986 % |
| | 2 | 124 522 | 296 req/s | 22 ms | 184 ms | **212 ms** | 805 ms | 3 | 99,998 % |
| | 3 | 99 635 | 237 req/s | 61 ms | 159 ms | **213 ms** | 794 ms | 18 | 99,982 % |
| Estado estable, 4 tareas | 1 | 129 553 | 308 req/s | 58 ms | 78 ms | **148 ms** | 678 ms | 8 | 99,994 % |
| | 2 | 178 869 | 426 req/s | 26 ms | 95 ms | **168 ms** | 782 ms | 2 | 99,999 % |
| **Ronda 0** (2 tareas, se detiene 1) | 1 | 94 945 | 226 req/s | 75 ms | 200 ms | **298 ms** | 2 369 ms | 0 | 100 % |
| **Ronda 1** (4 tareas, se detienen 2) | 1 | 126 379 | 301 req/s | 54 ms | 101 ms | **195 ms** | 1 815 ms | 10 | 99,992 % |
| | 2 | 123 981 | 295 req/s | 57 ms | 99 ms | **173 ms** | 1 377 ms | 7 | 99,994 % |
| | 3 | 115 268 | 274 req/s | 65 ms | 98 ms | **173 ms** | 1 231 ms | 16 | 99,986 % |

## 2. Comparación (mediana de cada grupo)

| Métrica | Estable 2 tareas | Ronda 0 | Estable 4 tareas | Ronda 1 | Variación ronda 0 → 1 |
|---|---|---|---|---|---|
| p50 | 61 ms | 75 ms | 42 ms | 57 ms | −24,2 % |
| p90 | 159 ms | 200 ms | 87 ms | 99 ms | −50,3 % |
| **p95** | **212 ms** | **298 ms** | **158 ms** | **173 ms** | **−42,0 %** |
| Máximo | 805 ms | 2 369 ms | 730 ms | 1 377 ms | −41,9 % |
| Throughput | 237 req/s | 226 req/s | 367 req/s | 295 req/s | +30,6 % |
| Éxito | 99,986 % | 100 % | 99,996 % | 99,992 % | sin cambio relevante |
| **MTTR** | | **66 s** (1 corrida) | | **86, 57 y 78 s** (mediana 78 s) | sin diferencia concluyente |

Además: la ronda 0 degrada el p95 un **+40,8 %** respecto al estado estable de 2 tareas (212 → 298 ms). La ronda 1 queda un **−18,4 %** por debajo de ese mismo estado estable de 2 tareas y un **+9,6 %** por encima de su propio estado estable de 4 tareas (por corrida: +23,5 %, +9,5 % y +9,6 %).

## 3. Hipótesis

1. **Original** (éxito ≥ 99 % y `p(95) < 350 ms`, de la mediana del p95 × 1,5): con el 50 % de las tareas detenidas **se cumple en la ronda 0** (100 % y 298 ms). No se refutó.
2. **Revisada** (p95 ≤ 254 ms y MTTR ≤ 90 s, es decir, el p95 del estado estable de 2 tareas más un 20 %): **se refuta en la ronda 0** (298 ms) y **se cumple en las 3 corridas de la ronda 1** (195, 173 y 173 ms; MTTR de 86, 57 y 78 s).

**Se endureció después de ver la ronda 0**, porque el p95 había subido un 40,8 % y apareció un máximo de 2 369 ms; hay que decirlo así en el informe y en la sustentación.

## 4. Modo de fallo y mejora

**Modo de fallo:** no hay errores (éxito ≈ 100 %). El balanceador saca la tarea detenida y la que queda atiende todo, así que se **pierde capacidad** y sube la latencia durante la recuperación. Una alerta solo sobre errores no lo vería: debe estar sobre el p95.

**Mejora:** `desired_count` de 2 a 4. Perder la mitad deja 2 tareas, la capacidad del estado estable original. Efecto: el p95 baja de 298 a 173 ms (−42,0 %) y queda dentro del umbral de 254 ms en las 3 corridas.

## 5. Reservas que hay que declarar

1. **El umbral revisado se fijó después de ver la ronda 0**.
2. **Frente a su propio estado estable de 4 tareas** (158 ms), la ronda 1 se degrada un +9,6 % de mediana, pero **una de las 3 corridas (195 ms, +23,5 %) supera el +20 %**. Por eso la afirmación honesta es «el p95 con la falla queda dentro del presupuesto absoluto de 254 ms en las 3 corridas», y no «nunca degrada más de un 20 %».
4. **El MTTR no mejora ni empeora de forma concluyente:** 66 s en la ronda 0 (una corrida) y entre 57 y 86 s en la ronda 1. Antes, con una sola corrida de la ronda 1 (86 s), parecía que empeoraba; con tres corridas ya no se puede afirmar.
5. **Costo:** 4 tareas de Fargate cuestan el doble por hora que 2. Volver a 2 o destruir al terminar.
6. **Peticiones fallidas:** entre 2 y 18 por corrida (≈ 0,01 %) en todos los grupos, incluidos los de estado estable. No se ha explicado la causa. **[Pipe: mirar el `k6.log` y decir en qué fase ocurren.]**
7. **Qué no cubre la mejora:** la pérdida de ambas zonas de disponibilidad, ni una falla de la base de datos.

## 6. Evidencia

`chaos/results/baseline/round-0/` (estado estable de 2 tareas), `chaos/results/baseline/round-1/` (estado estable de 4 tareas), `chaos/results/stop-tasks/round-0/` y `round-1/run-{1,2,3}/` (cada una con `k6-summary.json` y `journal-stop-tasks.json`).
