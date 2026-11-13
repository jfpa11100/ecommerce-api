#!/usr/bin/env bash
set -euo pipefail

STATE=$(aws cloudwatch describe-alarms --alarm-names "$CHAOS_ALARM" \
  --query 'MetricAlarms[0].StateValue' --output text)

echo "alarma=$STATE"
[ "$STATE" != "ALARM" ]