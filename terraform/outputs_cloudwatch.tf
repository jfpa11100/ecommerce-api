output "dashboard_url" {
  description = "Dashboard de CloudWatch: stable vs canary"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.canary.dashboard_name}"
}

output "canary_alarm_names" {
  description = "Alarmas del canary (separadas por comas) que revierten el despliegue en ECS"
  value       = "${aws_cloudwatch_metric_alarm.canary_error_rate.alarm_name},${aws_cloudwatch_metric_alarm.canary_latency_p95.alarm_name}"
}
