# ---------  AWS Secrets Manager (DB credential) -----------

resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.project_name}/${var.environment}/database-url"
  description             = "Connection string for PostgreSQL database"
  recovery_window_in_days = 0 # No need to wait for recovery
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"
}

resource "random_password" "chaos_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "chaos_token" {
  name                    = "${var.project_name}-${var.environment}-chaos-token"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "chaos_token" {
  secret_id     = aws_secretsmanager_secret.chaos_token.id
  secret_string = random_password.chaos_token.result
}