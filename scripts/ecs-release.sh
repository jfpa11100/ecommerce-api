#!/usr/bin/env bash
# Despliegue progresivo (LINEAL) con ECS nativo.
#
#   MODE=canary    -> registra una task definition nueva (imagen nueva, TRACK=canary),
#                     lanza el despliegue con una PAUSA en la Etapa 0, corre los smoke
#                     tests contra el listener de pruebas y continua o revierte.
#   MODE=finalize  -> relanza la MISMA imagen con TRACK=stable (un solo paso de 100%)
#                     para que las respuestas pasen a decir "stable" tras la promocion.
set -euo pipefail

MODE="${MODE:-canary}"
: "${CLUSTER_NAME:?Falta CLUSTER_NAME}"
: "${SERVICE_NAME:?Falta SERVICE_NAME}"

STEP_PERCENT="${STEP_PERCENT:-10}"
STEP_BAKE_MINUTES="${STEP_BAKE_MINUTES:-2}"
FINAL_BAKE_MINUTES="${FINAL_BAKE_MINUTES:-5}"
STAGE0_TIMEOUT_MINUTES="${STAGE0_TIMEOUT_MINUTES:-15}"
ALARM_NAMES="${ALARM_NAMES:-}"
MAX_WAIT_MINUTES="${MAX_WAIT_MINUTES:-80}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
SMOKE_SCRIPT="${SMOKE_SCRIPT:-$(dirname "$0")/smoke-stage0.sh}"
SAMPLER_URL="${SAMPLER_URL:-}"
SAMPLER_OUT="${SAMPLER_OUT:-traffic.csv}"
WORK="$(mktemp -d)"
DEPLOY_ARN=""
FINISHED=0
SAMPLER_PID=""
NEW_TD=""
DESC=""

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# Imprime evidencia adicional para diagnosticar fallos de ECS.
print_failure_diagnostics() {
  local title="${1:-Diagnostico ECS}"
  log "######## $title ########"

  if [ -n "$DESC" ]; then
    echo "$DESC" | jq '{
      status,
      statusReason,
      failureCode,
      failureReason,
      sourceServiceRevision,
      targetServiceRevision,
      alarms,
      lifecycleHookDetails,
      deploymentConfiguration
    }' >&2 || true
  fi

  log "Eventos recientes del servicio:"
  aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].events[:20]' \
    --output json >&2 || true

  log "Tareas detenidas asociadas a la nueva Task Definition ($NEW_TD):"
  local task_arns
  task_arns=$(aws ecs list-tasks \
    --cluster "$CLUSTER_NAME" \
    --service-name "$SERVICE_NAME" \
    --desired-status STOPPED \
    --query 'taskArns' \
    --output json 2>/dev/null | jq -r '.[]?' || true)

  if [ -n "$task_arns" ]; then
    # describe-tasks admite hasta 100 tareas por llamada.
    local -a tasks
    mapfile -t tasks <<< "$task_arns"
    for ((i=0; i<${#tasks[@]}; i+=100)); do
      local batch=("${tasks[@]:i:100}")
      aws ecs describe-tasks \
        --cluster "$CLUSTER_NAME" \
        --tasks "${batch[@]}" \
        --output json 2>/dev/null |
        jq --arg td "$NEW_TD" '
          [.tasks[]?
           | select(.taskDefinitionArn == $td)
           | {
               taskArn,
               taskDefinitionArn,
               lastStatus,
               desiredStatus,
               stoppedReason,
               stopCode,
               stoppedAt,
               containers: [.containers[]? | {
                 name, lastStatus, exitCode, reason
               }]
             }]
        ' >&2 || true
    done
  else
    log "No se encontraron tareas detenidas para inspeccionar."
  fi

  log "Fin del diagnostico ECS."
}

if [ "$MODE" = "canary" ]; then
  : "${IMAGE_URI:?Falta IMAGE_URI (repo@sha256:...)}"
  : "${APP_VERSION:?Falta APP_VERSION}"
  : "${TEST_URL:?Falta TEST_URL}"
  TRACK="canary"
elif [ "$MODE" = "finalize" ]; then
  TRACK="stable"
  STEP_PERCENT=100; STEP_BAKE_MINUTES=1; FINAL_BAKE_MINUTES=0
else
  echo "MODE debe ser canary o finalize" >&2; exit 2
fi

cleanup() {
  rc=$?
  if [ -n "$SAMPLER_PID" ]; then
    kill "$SAMPLER_PID" 2>/dev/null || true
    wait "$SAMPLER_PID" 2>/dev/null || true
    echo; echo "######## Evidencia de trafico (muestreo de $SAMPLER_URL) ########"
    bash "$(dirname "$0")/traffic-summary.sh" "$SAMPLER_OUT" || true
  fi
  if [ -n "$DEPLOY_ARN" ] && [ "$FINISHED" != "1" ]; then
    log "El despliegue no termino: solicitando ROLLBACK"
    aws ecs stop-service-deployment --service-deployment-arn "$DEPLOY_ARN" --stop-type ROLLBACK >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT

# --- 0) No debe haber otro despliegue activo ---
ACTIVE=$(aws ecs list-service-deployments --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" \
  --status PENDING IN_PROGRESS ROLLBACK_IN_PROGRESS --query 'length(serviceDeployments)' --output text)
if [ "$ACTIVE" != "0" ]; then
  echo "ERROR: ya hay $ACTIVE despliegue(s) activo(s) en $SERVICE_NAME. Espera a que terminen." >&2
  exit 1
fi

# --- 1) Nueva task definition a partir de la que usa el servicio hoy ---
CURRENT_TD=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" \
  --query 'services[0].taskDefinition' --output text)
log "Task definition actual: $CURRENT_TD"
aws ecs describe-task-definition --task-definition "$CURRENT_TD" --query taskDefinition --output json > "$WORK/td-current.json"

if [ "$MODE" = "finalize" ]; then
  APP_VERSION=$(jq -r '.containerDefinitions[] | select(.name=="api") | .environment[]? | select(.name=="APP_VERSION") | .value' "$WORK/td-current.json")
  IMAGE_URI=""
fi

jq --arg img "${IMAGE_URI:-}" --arg ver "$APP_VERSION" --arg track "$TRACK" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities,
      .registeredAt, .registeredBy, .deregisteredAt)
  | (.containerDefinitions[] | select(.name == "api")) |= (
      (if $img != "" then .image = $img else . end)
      | .environment = ((.environment // [])
          | map(select(.name != "APP_VERSION" and .name != "TRACK"))
          + [{name: "APP_VERSION", value: $ver}, {name: "TRACK", value: $track}])
    )' "$WORK/td-current.json" > "$WORK/td-new.json"

NEW_TD=$(aws ecs register-task-definition --cli-input-json "file://$WORK/td-new.json" \
  --query taskDefinition.taskDefinitionArn --output text)
log "Nueva task definition: $NEW_TD (version=$APP_VERSION, track=$TRACK)"

# --- 2) Plan de despliegue (se sobrescribe en cada release) ---
DEPLOY_CONFIG=$(jq -n \
  --argjson step "$STEP_PERCENT" --argjson stepbake "$STEP_BAKE_MINUTES" \
  --argjson bake "$FINAL_BAKE_MINUTES" --argjson timeout "$STAGE0_TIMEOUT_MINUTES" \
  --arg alarms "$ALARM_NAMES" --arg mode "$MODE" '
  {strategy: "LINEAR",
   bakeTimeInMinutes: $bake,
   linearConfiguration: {stepPercent: $step, stepBakeTimeInMinutes: $stepbake}}
  | if $mode == "canary" then
      .lifecycleHooks = [{
        targetType: "PAUSE",
        lifecycleStages: ["POST_TEST_TRAFFIC_SHIFT"],
        timeoutConfiguration: {timeoutInMinutes: $timeout, action: "ROLLBACK"}
      }]
    else . end
  | if $alarms != "" then
      .alarms = {alarmNames: ($alarms | split(",")), rollback: true, enable: true}
    else . end')
log "Plan: pasos de ${STEP_PERCENT}% cada ${STEP_BAKE_MINUTES} min, ventana de rollback ${FINAL_BAKE_MINUTES} min"
[ "$MODE" = "canary" ] && log "Etapa 0: pausa tras mover el trafico de prueba (timeout ${STAGE0_TIMEOUT_MINUTES} min -> ROLLBACK)"

# --- 3) Evidencia en vivo: que version/track responde mientras despliega ---
if [ -n "$SAMPLER_URL" ]; then
  bash "$(dirname "$0")/traffic-sampler.sh" "$SAMPLER_URL" "$SAMPLER_OUT" 1 &
  SAMPLER_PID=$!
  log "Muestreando $SAMPLER_URL cada 1 s -> $SAMPLER_OUT"
fi

# --- 4) Lanzar el despliegue ---
aws ecs update-service --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" \
  --task-definition "$NEW_TD" --deployment-configuration "$DEPLOY_CONFIG" >/dev/null
log "Despliegue solicitado"

for _ in $(seq 1 24); do
  CANDIDATE_ARNS=$(aws ecs list-service-deployments --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" \
    --status PENDING IN_PROGRESS --query 'serviceDeployments[].serviceDeploymentArn' --output text)
  for CANDIDATE_ARN in $CANDIDATE_ARNS; do
    CANDIDATE_DESC=$(aws ecs describe-service-deployments \
      --service-deployment-arns "$CANDIDATE_ARN" \
      --query 'serviceDeployments[0]' --output json)
    CANDIDATE_TD=$(jq -r '.targetServiceRevision.taskDefinition // empty' <<<"$CANDIDATE_DESC")
    if [ "$CANDIDATE_TD" = "$NEW_TD" ]; then
      DEPLOY_ARN="$CANDIDATE_ARN"
      break 2
    fi
  done
  sleep 5
done
[ -n "$DEPLOY_ARN" ] || {
  echo "ERROR: no se encontro un despliegue cuyo targetServiceRevision use $NEW_TD" >&2
  print_failure_diagnostics "No se pudo identificar el despliegue solicitado"
  exit 1
}
log "Despliegue: $DEPLOY_ARN"

# --- 5) Vigilar el despliegue; en canary, resolver la Etapa 0 ---
DEADLINE=$(( $(date +%s) + MAX_WAIT_MINUTES * 60 ))
GATE_DONE=0
ROLLBACK_REQUESTED=0
LAST=""
while :; do
  DESC=$(aws ecs describe-service-deployments --service-deployment-arns "$DEPLOY_ARN" \
    --query 'serviceDeployments[0]' --output json)
  STATUS=$(jq -r '.status' <<<"$DESC")
  REASON=$(jq -r '.statusReason // "Sin razon informada"' <<<"$DESC")

  if [ "$STATUS" != "$LAST" ]; then
    log "Estado del despliegue: $STATUS"
    log "Motivo: $REASON"
    LAST="$STATUS"
  fi

  case "$STATUS" in
    SUCCESSFUL)
      FINISHED=1
      log "Despliegue COMPLETADO"
      break
      ;;
    STOPPED|ROLLBACK_SUCCESSFUL|ROLLBACK_FAILED)
      FINISHED=1
      echo "ERROR: despliegue terminado en estado $STATUS" >&2
      echo "Motivo ECS: $REASON" >&2
      print_failure_diagnostics "Despliegue finalizado con error: $STATUS"
      exit 1
      ;;
  esac

  if [ "$MODE" = "canary" ] && [ "$GATE_DONE" -eq 0 ] && [ "$ROLLBACK_REQUESTED" -eq 0 ]; then
    HOOK=$(jq -r '[.lifecycleHookDetails[]? | select(.targetType=="PAUSE" and .status=="AWAITING_ACTION")][0].hookId // empty' <<<"$DESC")
    if [ -n "$HOOK" ]; then
      log "ETAPA 0: despliegue en pausa (0% de trafico publico). Ejecutando smoke tests..."
      if TEST_URL="$TEST_URL" EXPECTED_VERSION="$APP_VERSION" EXPECTED_TRACK="canary" bash "$SMOKE_SCRIPT"; then
        log "Smoke tests OK -> CONTINUE (empieza el reparto de trafico real)"
        aws ecs continue-service-deployment --service-deployment-arn "$DEPLOY_ARN" --hook-id "$HOOK" --action CONTINUE >/dev/null
        GATE_DONE=1
      else
        log "Smoke tests FALLARON -> ROLLBACK"
        aws ecs continue-service-deployment --service-deployment-arn "$DEPLOY_ARN" --hook-id "$HOOK" --action ROLLBACK >/dev/null
        ROLLBACK_REQUESTED=1
      fi
    fi
  fi

  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "ERROR: tiempo maximo de espera agotado ($MAX_WAIT_MINUTES min)" >&2
    print_failure_diagnostics "Tiempo maximo de espera agotado"
    exit 1
  fi
  sleep "$POLL_INTERVAL"
done
