# --------- Amazon ECS Fargate (+ CloudWatch Logs) ----------

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name                  = "api"
    image                 = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
    essential             = true
    wait_for_steady_state = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.container_port) },
      { name = "FAULT_HEADER_ENABLED", value = tostring(var.fault_header_enabled) },
      { name = "FAULT_ERROR_RATE", value = tostring(var.fault_error_rate) },
      { name = "FAULT_LATENCY_MS", value = tostring(var.fault_latency_ms) },
      { name = "OTEL_EXPORTER_OTLP_ENDPOINT", value = var.grafana_otlp_endpoint },
      { name = "OTEL_SERVICE_NAME", value = var.otel_service_name },
      { name = "DEPLOYMENT_ENVIRONMENT", value = var.environment },
      { name = "GRAFANA_INSTANCE_ID", value = var.grafana_instance_id },
      { name = "OTEL_DIAG", value = "true" }
    ]

    # ECS reads secret and exposes it as environment variable DATABASE_URL
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn },
      { name = "CHAOS_TOKEN", valueFrom = aws_secretsmanager_secret.chaos_token.arn },
      { name = "GRAFANA_OTLP_TOKEN", valueFrom = aws_secretsmanager_secret.grafana_otlp_token.arn }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name                   = "${var.project_name}-${var.environment}-service"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.app.arn
  desired_count          = var.desired_count
  launch_type            = "FARGATE"
  wait_for_steady_state  = true
  enable_execute_command = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  # Despliegues sin caída: arranca nuevas tareas antes de matar las viejas
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.http,
    terraform_data.db_schema
  ]
}
