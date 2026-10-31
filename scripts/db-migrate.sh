#!/usr/bin/env bash
# Aplica las migraciones SQL de docker/migrations (fase EXPAND del patron
# Expand/Contract) contra el RDS. El RDS es privado, asi que se usa una tarea
# Fargate de un solo uso dentro de la VPC con la imagen oficial de postgres,
# igual que en terraform/db_init.tf.
#
# Las migraciones deben ser IDEMPOTENTES (ADD COLUMN IF NOT EXISTS, etc.):
# este script las ejecuta todas, en orden alfabetico, en cada release.
set -euo pipefail

: "${CLUSTER_NAME:?Falta CLUSTER_NAME}"
: "${SUBNET_IDS:?Falta SUBNET_IDS (separadas por comas)}"
: "${SECURITY_GROUP_ID:?Falta SECURITY_GROUP_ID}"
: "${EXECUTION_ROLE_ARN:?Falta EXECUTION_ROLE_ARN}"
: "${DB_URL_SECRET_ARN:?Falta DB_URL_SECRET_ARN}"
: "${LOG_GROUP:?Falta LOG_GROUP}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:?Falta AWS_REGION}}"
FAMILY="${MIGRATE_FAMILY:-db-migrate}"
DB_IMAGE="${DB_INIT_IMAGE:-public.ecr.aws/docker/library/postgres:16-alpine}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-docker/migrations}"

shopt -s nullglob
FILES=("$MIGRATIONS_DIR"/*.sql)
if [ ${#FILES[@]} -eq 0 ]; then
  echo ">> No hay migraciones en $MIGRATIONS_DIR. Nada que hacer."
  exit 0
fi

echo ">> Migraciones a aplicar:"
printf '   - %s\n' "${FILES[@]}"
MIGRATIONS_SQL=$(cat "${FILES[@]}")

# Script que se ejecuta DENTRO del contenedor
CONTAINER_SCRIPT=$(cat <<'EOS'
set -eu
echo "Aplicando migraciones..."
printf '%s' "$MIGRATIONS_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f -
echo "Migraciones aplicadas. Estructura actual de products:"
psql "$DATABASE_URL" -c '\d products'
EOS
)

CONTAINER_DEFS=$(jq -n \
  --arg image "$DB_IMAGE" \
  --arg script "$CONTAINER_SCRIPT" \
  --arg sql "$MIGRATIONS_SQL" \
  --arg secret "$DB_URL_SECRET_ARN" \
  --arg log_group "$LOG_GROUP" \
  --arg region "$REGION" \
  '[{
    name: "db-migrate",
    image: $image,
    essential: true,
    entryPoint: ["sh", "-c"],
    command: [$script],
    environment: [{name: "MIGRATIONS_SQL", value: $sql}],
    secrets: [{name: "DATABASE_URL", valueFrom: $secret}],
    logConfiguration: {
      logDriver: "awslogs",
      options: {
        "awslogs-group": $log_group,
        "awslogs-region": $region,
        "awslogs-stream-prefix": "db-migrate"
      }
    }
  }]')

echo ">> Registrando task definition de migracion ($FAMILY)..."
TASK_DEFINITION=$(aws ecs register-task-definition \
  --family "$FAMILY" \
  --requires-compatibilities FARGATE \
  --network-mode awsvpc \
  --cpu 256 --memory 512 \
  --execution-role-arn "$EXECUTION_ROLE_ARN" \
  --container-definitions "$CONTAINER_DEFS" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

echo ">> Lanzando tarea de migracion..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "ERROR: ECS no pudo lanzar la tarea de migracion" >&2
  exit 1
fi
TASK_ID=$(basename "$TASK_ARN")

aws ecs wait tasks-stopped --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN"

echo ">> Logs de la tarea:"
aws logs get-log-events --log-group-name "$LOG_GROUP" \
  --log-stream-name "db-migrate/db-migrate/$TASK_ID" \
  --query 'events[].message' --output text || true

EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)

if [ "$EXIT_CODE" != "0" ]; then
  REASON=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" \
    --query 'tasks[0].stoppedReason' --output text)
  echo "ERROR: fallo al aplicar las migraciones (exitCode=$EXIT_CODE, motivo=$REASON)" >&2
  exit 1
fi
echo ">> Migraciones OK"
