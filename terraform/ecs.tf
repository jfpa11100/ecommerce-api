# --------- Amazon ECS Fargate (+ CloudWatch Logs) ----------
# El servicio usa CodeDeploy como controlador de despliegues (blue/green + canary).
# Terraform crea el servicio y una task definition "base"; los releases posteriores
# los hace el pipeline: registra una task definition nueva y crea un despliegue
# en CodeDeploy

locals {
  # Imagen inmutable: con digest -> repo@sha256:..., sin digest -> repo:tag.
  app_image = var.image_digest != "" ? "${aws_ecr_repository.app.repository_url}@${var.image_digest}" : "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
}

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
    name      = "api"
    image     = local.app_image
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.container_port) },
      { name = "APP_VERSION", value = var.app_version },
      { name = "TRACK", value = var.app_track }
    ]

    # ECS reads secret and exposes it as environment variable DATABASE_URL
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn }
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
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.blue.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  # CodeDeploy cambia la task definition y el target group en cada despliegue.
  lifecycle {
    ignore_changes = [task_definition, load_balancer]
  }

  depends_on = [
    aws_lb_listener.http,
    aws_lb_listener.test,
    terraform_data.db_schema
  ]
}
