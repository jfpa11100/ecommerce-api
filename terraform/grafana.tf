resource "aws_secretsmanager_secret" "grafana_otlp_token" {
  name                    = "${var.project_name}-${var.environment}-grafana-otlp-token"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "grafana_otlp_token" {
  secret_id     = aws_secretsmanager_secret.grafana_otlp_token.id
  secret_string = var.grafana_otlp_token
}