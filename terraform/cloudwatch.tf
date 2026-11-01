# ---------------------------------------------------------------------------
# CloudWatch: dashboard stable vs canary + alarmas del canary
# Las metricas las publica la API (formato EMF) en el namespace EcommerceApi,
# con la dimension Track = stable | canary.
# Los umbrales salen de slo/canary-slo.yaml (fuente unica de verdad).
# ---------------------------------------------------------------------------

locals {
  slo    = yamldecode(file("${path.module}/../slo/canary-slo.yaml"))
  prefix = "${var.project_name}-${var.environment}"
  ns     = "EcommerceApi"

  track_colors = {
    stable = "#2ca02c"
    canary = "#ff7f0e"
  }
  track_names = keys(local.track_colors)

  min_requests_per_minute = local.slo.alarms.min_requests_per_minute
}

# ----------------------------- Alarmas -------------------------------------

# ABORTO por errores: tasa de 5xx del canary por encima del umbral de aborto.
resource "aws_cloudwatch_metric_alarm" "canary_error_rate" {
  alarm_name          = "${local.prefix}-canary-5xx-rate"
  alarm_description   = "Tasa de errores 5xx del canary por encima del umbral de aborto (slo/canary-slo.yaml)"
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.slo.decision.abort.error_rate_5xx_pct
  evaluation_periods  = 2
  datapoints_to_alarm = 1
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "rate"
    expression  = "IF(req >= ${local.min_requests_per_minute}, 100 * err / req, 0)"
    label       = "canary 5xx rate (%)"
    return_data = true
  }

  metric_query {
    id = "req"
    metric {
      namespace   = local.ns
      metric_name = "Requests"
      period      = 60
      stat        = "Sum"
      dimensions  = { Track = "canary" }
    }
  }

  metric_query {
    id = "err"
    metric {
      namespace   = local.ns
      metric_name = "Http5xx"
      period      = 60
      stat        = "Sum"
      dimensions  = { Track = "canary" }
    }
  }
}

# ABORTO por latencia: p95 del canary por encima del umbral de aborto.
resource "aws_cloudwatch_metric_alarm" "canary_latency_p95" {
  alarm_name          = "${local.prefix}-canary-latency-p95"
  alarm_description   = "Latencia p95 del canary por encima del umbral de aborto (slo/canary-slo.yaml)"
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.slo.decision.abort.latency_p95_ms
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "p95"
    expression  = "IF(req >= ${local.min_requests_per_minute}, lat, 0)"
    label       = "canary latency p95 (ms)"
    return_data = true
  }

  metric_query {
    id = "req"
    metric {
      namespace   = local.ns
      metric_name = "Requests"
      period      = 60
      stat        = "Sum"
      dimensions  = { Track = "canary" }
    }
  }

  metric_query {
    id = "lat"
    metric {
      namespace   = local.ns
      metric_name = "LatencyMs"
      period      = 60
      stat        = "p95"
      dimensions  = { Track = "canary" }
    }
  }
}

# ----------------------------- Dashboard -----------------------------------

locals {
  # p50 / p95 / p99 de la latencia
  latency_widget = { for p in ["p50", "p95", "p99"] : p => [
    for t in local.track_names : [local.ns, "LatencyMs", "Track", t, { stat = p, label = t, color = local.track_colors[t] }]
  ] }

  # Porcentaje A/B por track (A y B son metricas Sum del namespace)
  ratio_rows = { for key, def in {
    err5xx   = { num = "Http5xx", den = "Requests" }
    err4xx   = { num = "Http4xx", den = "Requests" }
    lowstock = { num = "LowStockProductsListed", den = "ProductsListed" }
    } : key => concat([for i, t in local.track_names : [
      [{ expression = "100 * n${i} / d${i}", id = "r${i}", label = t, color = local.track_colors[t] }],
      [local.ns, def.num, "Track", t, { id = "n${i}", stat = "Sum", visible = false }],
      [local.ns, def.den, "Track", t, { id = "d${i}", stat = "Sum", visible = false }],
    ]]...)
  }

  # % del trafico que atiende el canary (avance de las etapas: 10, 20, 30 ... 100;
  # y cae a 0 cuando hay rollback)
  share_rows = [
    [{ expression = "100 * FILL(c, 0) / (FILL(c, 0) + FILL(s, 0))", id = "share", label = "canary % del trafico", color = "#ff7f0e" }],
    [local.ns, "Requests", "Track", "canary", { id = "c", stat = "Sum", visible = false }],
    [local.ns, "Requests", "Track", "stable", { id = "s", stat = "Sum", visible = false }],
  ]

  dashboard_widgets = [
    {
      type   = "text"
      x      = 0
      y      = 0
      width  = 24
      height = 2
      properties = {
        markdown = "# Canary vs Stable  |  ${local.prefix}\nVerde = **stable**, naranja = **canary**. Las lineas rojas son los umbrales de ABORTO y las amarillas los de PAUSA (`slo/canary-slo.yaml`). El grafico de **% del trafico del canary** muestra el avance de las etapas y cae a 0 cuando hay rollback."
      }
    },
    {
      type   = "metric"
      x      = 0
      y      = 2
      width  = 8
      height = 6
      properties = {
        title   = "Avance de etapas: % del trafico atendido por el canary"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        stat    = "Sum"
        metrics = local.share_rows
        yAxis   = { left = { min = 0, max = 100 } }
      }
    },
    {
      type   = "metric"
      x      = 8
      y      = 2
      width  = 8
      height = 6
      properties = {
        title   = "Trafico: peticiones por minuto"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = [for t in local.track_names : [local.ns, "Requests", "Track", t, { stat = "Sum", label = t, color = local.track_colors[t] }]]
        annotations = {
          horizontal = [{ label = "minimo por track y ventana / ventana (muestras suficientes)", value = local.slo.sampling.min_requests_per_track / local.slo.sampling.window_minutes, color = "#9467bd" }]
        }
      }
    },
    {
      type   = "alarm"
      x      = 16
      y      = 2
      width  = 8
      height = 6
      properties = {
        title  = "Alarmas del canary (rollback automatico)"
        alarms = [aws_cloudwatch_metric_alarm.canary_error_rate.arn, aws_cloudwatch_metric_alarm.canary_latency_p95.arn]
      }
    },
    {
      type   = "metric"
      x      = 0
      y      = 8
      width  = 8
      height = 6
      properties = {
        title   = "Errores 5xx (% de las peticiones)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        stat    = "Sum"
        metrics = local.ratio_rows.err5xx
        annotations = {
          horizontal = [
            { label = "ABORTAR", value = local.slo.decision.abort.error_rate_5xx_pct, color = "#d62728" },
            { label = "PAUSAR", value = local.slo.decision.pause.error_rate_5xx_pct, color = "#bcbd22" },
          ]
        }
      }
    },
    {
      type   = "metric"
      x      = 8
      y      = 8
      width  = 8
      height = 6
      properties = {
        title   = "Errores 4xx (% de las peticiones)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        stat    = "Sum"
        metrics = local.ratio_rows.err4xx
      }
    },
    {
      type   = "metric"
      x      = 16
      y      = 8
      width  = 8
      height = 6
      properties = {
        title   = "Negocio: % de productos listados con stock bajo (< 5 uds.)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        stat    = "Sum"
        metrics = local.ratio_rows.lowstock
      }
    },
    {
      type   = "metric"
      x      = 0
      y      = 14
      width  = 8
      height = 6
      properties = {
        title   = "Latencia p50 (ms)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = local.latency_widget["p50"]
      }
    },
    {
      type   = "metric"
      x      = 8
      y      = 14
      width  = 8
      height = 6
      properties = {
        title   = "Latencia p95 (ms)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = local.latency_widget["p95"]
        annotations = {
          horizontal = [{ label = "ABORTAR", value = local.slo.decision.abort.latency_p95_ms, color = "#d62728" }]
        }
      }
    },
    {
      type   = "metric"
      x      = 16
      y      = 14
      width  = 8
      height = 6
      properties = {
        title   = "Latencia p99 (ms)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = local.latency_widget["p99"]
      }
    },
    {
      type   = "metric"
      x      = 0
      y      = 20
      width  = 12
      height = 6
      properties = {
        title   = "Saturacion: CPU (% de lo asignado a la tarea)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = [for t in local.track_names : [local.ns, "CpuPercent", "Track", t, { stat = "Average", label = t, color = local.track_colors[t] }]]
        annotations = {
          horizontal = [{ label = "ABORTAR", value = local.slo.decision.abort.cpu_pct, color = "#d62728" }]
        }
      }
    },
    {
      type   = "metric"
      x      = 12
      y      = 20
      width  = 12
      height = 6
      properties = {
        title   = "Saturacion: memoria (% de lo asignado a la tarea)"
        view    = "timeSeries"
        region  = var.aws_region
        period  = 60
        metrics = [for t in local.track_names : [local.ns, "MemoryPercent", "Track", t, { stat = "Average", label = t, color = local.track_colors[t] }]]
        annotations = {
          horizontal = [{ label = "ABORTAR", value = local.slo.decision.abort.memory_pct, color = "#d62728" }]
        }
      }
    },
  ]
}

resource "aws_cloudwatch_dashboard" "canary" {
  dashboard_name = "${local.prefix}-canary"
  dashboard_body = jsonencode({ widgets = local.dashboard_widgets })
}
