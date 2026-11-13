output "api_url" {
  description = "public URL of the API"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "URL of the ECR repository (for docker push)"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint (only accessible from the VPC)"
  value       = aws_db_instance.postgres.address
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "db_init_log_group" {
  value = aws_cloudwatch_log_group.db_init.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "chaos_alarm_name" {
  value = aws_cloudwatch_metric_alarm.chaos_abort.alarm_name
}

output "chaos_token_secret_id" {
  value = aws_secretsmanager_secret.chaos_token.id
}