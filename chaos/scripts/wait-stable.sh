#!/usr/bin/env bash
set -euo pipefail
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"