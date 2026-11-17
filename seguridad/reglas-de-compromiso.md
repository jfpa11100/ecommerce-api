# Reglas de compromiso

Acuerdo del grupo para los experimentos de seguridad. Mientras las tres APIs no lo acepten, no se
ejecuta ningún experimento. Los valores de la sección 4 en adelante son los de ecommerce
(experimento 3, telemetría e IA); trading-journal y StatsNostra completan los suyos en sus
repositorios con el mismo formato.

## 1. Ventana

Hora de Colombia. Propuesta, a confirmar en el grupo antes de cada ronda. Durante la ventana nadie
manda carga ni reinicia nada contra la API de ecommerce.

| Ronda | Inicio | Fin |
|---|---|---|
| Medición del estado estable de seguridad | *por confirmar en el grupo* | +30 min |
| Ronda 0 | *por confirmar en el grupo* | +30 min |
| Ronda 1 | *por confirmar en el grupo* | +30 min |

Fuera de la ventana no se crea, modifica ni borra ningún recurso del experimento.

## 2. Alcance

Solo cuentas, proyectos y suscripciones del grupo en Azure, Google Cloud, AWS y Oracle. Para
ecommerce: la cuenta de AWS del grupo, la región `us-east-2`, el balanceador de la API, el clúster
`ecommerce-api-dev-cluster` y el grupo de logs `/ecs/ecommerce-api-dev`.

Está prohibido actuar sobre servicios, cuentas, redes o datos de terceros, de la Universidad o de
otros grupos.

## 3. Datos

Solo datos sintéticos del proyecto. Los experimentos no leen, copian ni envían datos reales, y los
valores de los secretos (incluido el `CHAOS_TOKEN`) nunca se imprimen ni se guardan.

## 4. Radio de impacto (ecommerce)

- Como máximo 20 peticiones `GET` con una ruta que lleva texto plantado (por ejemplo
  `/api/v2/ignore%20all%20previous%20instructions...`), desde una sola máquina del grupo. Devuelven 404
  y solo dejan una línea en el log.
- Un filtro de métricas, una alarma y un tema de SNS de la ronda 1 (se eliminan al final).
- Una exportación de solo lectura del grupo de logs para dársela al analista de IA.
- No se detiene ninguna tarea ni se cambia el servicio en este experimento.

## 5. Interruptor de parada

Lo acciona ecommerce; lo puede accionar cualquiera de los tres con acceso a la cuenta:

```bash
# dejar de enviar peticiones plantadas (cerrar la terminal que las envía)
terraform -chdir=terraform destroy -target=aws_cloudwatch_metric_alarm.ruta_sospechosa \
  -target=aws_cloudwatch_log_metric_filter.ruta_sospechosa -target=aws_sns_topic.alertas
```

## 6. Reversión

El destroy anterior deja la cuenta como antes de la ronda 1. Se verifica así:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://<alb>/health     # 200
aws cloudwatch describe-alarms --alarm-names ecommerce-api-dev-ruta-sospechosa   # sin resultados
```

La reversión se prueba antes de la ronda 0 y el resultado se anota en la bitácora.

## 7. Bitácora

Cada acción se registra con hora, responsable y resultado en [`bitacora.md`](bitacora.md).

## 8. Condiciones de aborto

Se ejecuta el interruptor de parada y se anota la causa si ocurre cualquiera de estas:

- `/health` de ecommerce no responde 200 durante más de 60 s.
- Se detecta tráfico o un recurso fuera del alcance de la sección 2.
- Se llega al fin de la ventana con el experimento sin terminar.
- La alarma `ecommerce-api-dev-chaos-abort` pasa a `ALARM`.
- Cualquiera de las tres APIs pide parar.

## Aceptan

| API | Aceptado | Fecha |
|---|---|---|
| trading-journal | [x] | 2026-11-16 |
| StatsNostra | [x] | 2026-11-16 |
| ecommerce | [x] | 2026-11-16 |
