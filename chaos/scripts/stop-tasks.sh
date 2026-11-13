#!/usr/bin/env bash
set -euo pipefail

PERCENT="${1:-50}"
TASKS=$(aws ecs list-tasks --cluster "$ECS_CLUSTER" --service-name "$ECS_SERVICE" \
  --desired-status RUNNING --query 'taskArns[]' --output text)

TOTAL=$(echo "$TASKS" | wc -w)
COUNT=$(( (TOTAL * PERCENT + 99) / 100 ))   # redondeo hacia arriba
[ "$COUNT" -lt 1 ] && COUNT=1

for T in $(echo "$TASKS" | tr '\t' '\n' | shuf -n "$COUNT"); do
  aws ecs stop-task --cluster "$ECS_CLUSTER" --task "$T" --reason "chaos-experiment" > /dev/null
  echo "Tarea detenida: $T"
done