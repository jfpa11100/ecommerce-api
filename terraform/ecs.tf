# --------- Amazon ECS Fargate (+ CloudWatch Logs) ----------
# El servicio usa los despliegues nativos de ECS con estrategia CANARY.
# Terraform crea el servicio y una task definition "base"; los releases
# posteriores los hace el pipeline (task definition nueva + aws ecs update-service),

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
    type = "ECS"
  }

  # Estrategia canary nativa: primero un % pequeno de trafico real a la revision
  # nueva, espera canary_bake_time_in_minutes, y luego mueve el resto.
  # bake_time_in_minutes: tiempo que se conserva la revision anterior tras
  # mover todo el trafico (ventana de rollback rapido).
  deployment_configuration {
    strategy             = "CANARY"
    bake_time_in_minutes = var.deployment_bake_time_minutes

    canary_configuration {
      canary_percent              = var.canary_percent
      canary_bake_time_in_minutes = var.canary_bake_time_minutes
    }
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

    # Piezas que ECS necesita para repartir el trafico entre las dos revisiones
    advanced_configuration {
      alternate_target_group_arn = aws_lb_target_group.green.arn
      production_listener_rule   = aws_lb_listener_rule.production.arn
      test_listener_rule         = aws_lb_listener_rule.test.arn
      role_arn                   = aws_iam_role.ecs_infrastructure.arn
    }
  }

  # Los releases cambian la task definition desde el pipeline.
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [
    aws_lb_listener_rule.production,
    aws_lb_listener_rule.test,
    aws_iam_role_policy_attachment.ecs_infrastructure_lb,
    terraform_data.db_schema
  ]
}
