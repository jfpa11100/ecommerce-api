# Bitácora de los experimentos de seguridad de ecommerce

## 1. Estado de seguridad en estable

**Experimento 3 · Ronda 0 · Línea base de falsos positivos**

### 1.1 Contexto
- **Inicio del envío:** 2026-11-17T14:48:30Z (UTC)
- **Fin del envío:** 2026-11-17T14:48:34Z (UTC)
- **Región / grupo de logs:** `us-east-2` / `/ecs/ecommerce-api-dev`
- **Objetivo (ALB):** `http://ecommerce-api-dev-alb-1955683949.us-east-2.elb.amazonaws.com`

### 1.2 Configuración de defensa (ronda 0, "como está hoy")
| Control | Estado |
|---|---|
| Registro de la ruta (`route` en `request-logger.ts`) | Sin sanitizar: se guarda tal como llega (sin decodificar) |
| Registro de `traceId` | Sin validar: se acepta el valor de `X-Trace-Id` tal cual |
| Filtro de rutas sospechosas | No existe |
| Alarma y correo | No existen |
| Entrada del analista de IA | Sin sanitizar |
| Verificación de la respuesta de la IA | No existe |

### 1.3 Tráfico de línea base
20 peticiones normales, enviadas con `curl` y una cabecera `X-Trace-Id` propia:

| Ruta | `X-Trace-Id` | Peticiones |
|---|---|---|
| `/api/v1/commerce` | `exp3-base-1` … `exp3-base-10` | 10 |
| `/api/v1/products` | `exp3-base-p1` … `exp3-base-p10` | 10 |

### 1.4 Resultados
| Comprobación | Resultado |
|---|---|
| Peticiones registradas en el log | **20 de 20** |
| Códigos de estado | 20 × `200` |
| Rutas distintas en la línea base | 2 (`/api/v1/products`, `/api/v1/commerce`) |
| Rutas sospechosas según la regla v0 | **0 de 20** |
| Alertas generadas | 0 (no existe alarma en esta ronda) |


**Consulta de verificación Regla v0 de "ruta sospechosa"** (resultado esperado: 0):
```
filter traceId like /^exp3-base-/
| filter route like /%/ or route like /(?i)(ignore|instruction|previous|system|prompt|assistant)/ or strlen(route) > 80
| stats count() as sospechosas
```
Resultado: 0 Filas

### 1.5 Conclusión
- **Falsos positivos de la línea base: 0/20.** En la ronda 1, estas mismas 20 peticiones **no deben activar la alarma**.
- Las rutas de negocio legítimas son solo `/api/v1/commerce` y `/api/v1/products`. `/health` no aparece en el log.

### 1.6 Observaciones del estado actual
- La ruta y el `traceId` los controla quien hace la petición y se escriben en el log sin validación. Son dos puntos por donde se puede plantar texto en la telemetría.
- Tráfico posterior a la línea base (peticiones con `traceId` `exp3-r0-*`).
