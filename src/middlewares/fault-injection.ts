import type { Request, Response, NextFunction } from 'express'
import { APP_TRACK } from './version-headers.ts'
import { isApiPath } from './metrics.ts'

// ---------------------------------------------------------------------------
// Inyeccion de fallos CONTROLADA para simular una regresion en produccion.
//   FAULT_ERROR_RATE  0..1     fraccion de peticiones /api/* que responden 500
//   FAULT_LATENCY_MS  0..10000 retraso (ms) que se anade a cada peticion /api/*
//
// Salvaguardas:
//  - Solo actua si TRACK=canary (aunque la variable quedara en una version stable,
//    se ignora). La version estable nunca se degrada.
//  - Las pone el pipeline de release SOLO en la task definition del canary.
//  - No toca /health ni /version: el servicio sigue "sano" para ECS/ALB mientras
//    el trafico de negocio se degrada, que es lo que hace una regresion real.
// ---------------------------------------------------------------------------

export interface FaultConfig {
  enabled: boolean
  errorRate: number
  latencyMs: number
}

function clampedNumber(value: string | undefined, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(max, Math.max(min, n))
}

export function loadFaultConfig(env: NodeJS.ProcessEnv, track: string): FaultConfig {
  return {
    enabled: track === 'canary',
    errorRate: clampedNumber(env.FAULT_ERROR_RATE, 0, 1),
    latencyMs: clampedNumber(env.FAULT_LATENCY_MS, 0, 10_000),
  }
}

export function faultsActive(cfg: FaultConfig): boolean {
  return cfg.enabled && (cfg.errorRate > 0 || cfg.latencyMs > 0)
}

// Decision para UNA peticion. "random" se puede inyectar para probarlo.
export function decideFault(cfg: FaultConfig, random: () => number = Math.random) {
  const fail = cfg.errorRate > 0 && random() < cfg.errorRate
  // pequena variacion (hasta +20%) para que la latencia no sea una constante exacta
  const delayMs = cfg.latencyMs > 0 ? Math.round(cfg.latencyMs * (1 + random() * 0.2)) : 0
  return { fail, delayMs }
}

export const faultConfig = loadFaultConfig(process.env, APP_TRACK)

export function describeFaults(cfg: FaultConfig = faultConfig) {
  return {
    active: faultsActive(cfg),
    errorRate: cfg.enabled ? cfg.errorRate : 0,
    latencyMs: cfg.enabled ? cfg.latencyMs : 0,
  }
}

export function faultInjection(req: Request, res: Response, next: NextFunction) {
  if (!faultsActive(faultConfig) || !isApiPath(req.originalUrl)) return next()

  const { fail, delayMs } = decideFault(faultConfig)
  const proceed = () => {
    if (fail) {
      res.status(500).json({ error: 'Injected fault (simulated regression)', injected: true })
    } else {
      next()
    }
  }
  if (delayMs > 0) setTimeout(proceed, delayMs)
  else proceed()
}

if (faultsActive(faultConfig)) {
  console.warn(`[fault-injection] ACTIVO en track=canary: errorRate=${faultConfig.errorRate} latencyMs=${faultConfig.latencyMs}`)
}
