#!/usr/bin/env bash
set -euo pipefail

read -r RUNNING DESIRED <<< "$(aws ecs describe-services --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" --query 'services[0].[runningCount,desiredCount]' --output text)"

echo "running=$RUNNING desired=$DESIRED"
[ "$RUNNING" = "$DESIRED" ]