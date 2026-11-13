#!/usr/bin/env bash
set -uo pipefail

TIMEOUT="${1:-300}"
START=$(date +%s)

while true; do
  read -r RUNNING DESIRED <<< "$(aws ecs describe-services --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" --query 'services[0].[runningCount,desiredCount]' --output text)"
  ELAPSED=$(( $(date +%s) - START ))
  echo "t=${ELAPSED}s running=${RUNNING} desired=${DESIRED}"

  if [ "$RUNNING" = "$DESIRED" ]; then
    echo "Recuperado en ${ELAPSED}s"
    exit 0
  fi
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "No se recuperó en ${TIMEOUT}s"
    exit 1
  fi
  sleep 10
done