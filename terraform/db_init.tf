locals {
  db_init_name = "${var.project_name}-${var.environment}-db-init"
  schema_sql   = file("${path.module}/${var.schema_sql_path}")

  # Script that runs INSIDE the container
  db_init_script = <<-EOT
    set -eu
    echo "Comprobando si el esquema ya existe..."
    TABLES=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
    if [ "$TABLES" -gt 0 ]; then
      echo "Ya hay $TABLES tablas en 'public'. No se aplica nada."
      exit 0
    fi
    echo "Base de datos vacia. Aplicando esquema..."
    printf '%s' "$SCHEMA_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f -
    echo "Esquema aplicado. Tablas resultantes:"
    psql "$DATABASE_URL" -c '\dt'
  EOT
}

resource "aws_cloudwatch_log_group" "db_init" {
  name              = "/ecs/${local.db_init_name}"
  retention_in_days = var.db_init_log_retention_days
}

resource "aws_ecs_task_definition" "db_init" {
  family                   = local.db_init_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name       = "db-init"
    image      = var.db_init_image
    essential  = true
    entryPoint = ["sh", "-c"]
    command    = [local.db_init_script]

    environment = [{ name = "SCHEMA_SQL", value = local.schema_sql }]
    secrets     = [{ name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.db_init.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "db-init"
      }
    }
  }])
}

resource "terraform_data" "db_schema" {
  # resource_id changes ONLY when the RDS is created or recreated
  triggers_replace = [aws_db_instance.postgres.resource_id]

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]

    environment = {
      AWS_DEFAULT_REGION = var.aws_region
      CLUSTER_NAME       = aws_ecs_cluster.main.name
      TASK_DEFINITION    = aws_ecs_task_definition.db_init.arn
      SUBNET_IDS         = join(",", aws_subnet.private[*].id)
      SECURITY_GROUP_ID  = aws_security_group.ecs.id
      LOG_GROUP          = aws_cloudwatch_log_group.db_init.name
    }

    command = <<-EOT
      set -euo pipefail

      echo ">> Lanzando tarea de inicializacion del esquema..."
      TASK_ARN=$(aws ecs run-task \
        --cluster "$CLUSTER_NAME" \
        --task-definition "$TASK_DEFINITION" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=DISABLED}" \
        --query 'tasks[0].taskArn' --output text)

      if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
        echo "ERROR: ECS no pudo lanzar la tarea" >&2
        exit 1
      fi
      TASK_ID=$(basename "$TASK_ARN")

      aws ecs wait tasks-stopped --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN"

      echo ">> Logs de la tarea:"
      aws logs get-log-events --log-group-name "$LOG_GROUP" \
        --log-stream-name "db-init/db-init/$TASK_ID" \
        --query 'events[].message' --output text || true

      EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" \
        --query 'tasks[0].containers[0].exitCode' --output text)

      if [ "$EXIT_CODE" != "0" ]; then
        REASON=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" \
          --query 'tasks[0].stoppedReason' --output text)
        echo "ERROR: fallo al aplicar el esquema (exitCode=$EXIT_CODE, motivo=$REASON)" >&2
        exit 1
      fi
      echo ">> Esquema OK"
    EOT
  }

  depends_on = [
    aws_secretsmanager_secret_version.db_url,
    aws_nat_gateway.main,
    aws_route_table_association.private,
  ]
}