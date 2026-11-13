# --------- Alarma de aborto para experimentos de caos ----------

resource "aws_cloudwatch_metric_alarm" "chaos_abort" {
  alarm_name          = "${var.project_name}-${var.environment}-chaos-abort"
  alarm_description   = "Se activa si los 5xx superan el umbral durante un experimento"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "total5xx"
    expression  = "elb5xx + target5xx"
    label       = "5xx totales"
    return_data = true
  }

  metric_query {
    id = "elb5xx"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_ELB_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }

  metric_query {
    id = "target5xx"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }
}