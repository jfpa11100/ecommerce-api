import type { Request, Response, NextFunction } from 'express'
import os from 'node:os'
import { APP_TRACK, APP_VERSION, INSTANCE_ID } from './version-headers.ts'

// ---------------------------------------------------------------------------
// Metricas para CloudWatch en formato EMF (Embedded Metric Format).
// Cada linea JSON que se escribe en stdout la convierte CloudWatch en metricas
// SIN permisos IAM adicionales (el contenedor ya envia sus logs con awslogs).
//
// Todas las metricas llevan la dimension "Track" (stable | canary): asi el
// dashboard y las alarmas comparan stable vs canary sin depender de que target
// group o task definition este sirviendo cada track en cada release.
// ---------------------------------------------------------------------------

export const METRICS_NAMESPACE = process.env.METRICS_NAMESPACE ?? 'EcommerceApi'
export const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false'

// REGLA DE NEGOCIO (metrica propia del dominio): un producto con menos de N
// unidades disponibles se considera "stock bajo". En cada listado de productos
// se mide cuantos productos se listaron y cuantos tenian stock bajo.
export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD ?? 4)

const PRODUCT_LIST_PATH = /^\/api\/v\d+\/products\/?$/

type MetricUnit = 'Count' | 'Milliseconds' | 'Percent'
export type MetricValues = Record<string, { value: number; unit: MetricUnit }>

// Solo se miden las peticiones de negocio (/api/*): /health y /version quedan
// fuera para que los health checks del ALB y el muestreador no contaminen las cifras.
export function isApiPath(url: string): boolean {
  return url.startsWith('/api/')
}

export function countLowStock(items: unknown[], threshold = LOW_STOCK_THRESHOLD): number {
  return items.filter((item) => {
    const stock = (item as { amountAvailable?: unknown } | null)?.amountAvailable
    return typeof stock === 'number' && stock < threshold
  }).length
}

export function buildEmf(
  track: string,
  metrics: MetricValues,
  properties: Record<string, string | number | boolean> = {},
  timestamp: number = Date.now(),
) {
  return {
    _aws: {
      Timestamp: timestamp,
      CloudWatchMetrics: [
        {
          Namespace: METRICS_NAMESPACE,
          Dimensions: [['Track']],
          Metrics: Object.entries(metrics).map(([Name, m]) => ({ Name, Unit: m.unit })),
        },
      ],
    },
    Track: track,
    ...Object.fromEntries(Object.entries(metrics).map(([name, m]) => [name, m.value])),
    ...properties,
  }
}

function emit(line: object): void {
  if (METRICS_ENABLED) process.stdout.write(JSON.stringify(line) + '\n')
}

// Mide trafico, errores 4xx/5xx y latencia de cada peticion /api/* (+ metrica de negocio)
export function requestMetrics(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split('?')[0]
  if (!METRICS_ENABLED || !isApiPath(path)) return next()

  const start = process.hrtime.bigint()
  const isProductList = (req.method === 'GET' || req.method === 'QUERY') && PRODUCT_LIST_PATH.test(path)
  let business: { listed: number; lowStock: number } | null = null

  if (isProductList) {
    const originalJson = res.json.bind(res)
    res.json = ((body?: unknown) => {
      if (Array.isArray(body)) business = { listed: body.length, lowStock: countLowStock(body) }
      return originalJson(body)
    }) as Response['json']
  }

  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6
    const status = res.statusCode
    const metrics: MetricValues = {
      Requests: { value: 1, unit: 'Count' },
      Http5xx: { value: status >= 500 ? 1 : 0, unit: 'Count' },
      Http4xx: { value: status >= 400 && status < 500 ? 1 : 0, unit: 'Count' },
      LatencyMs: { value: Math.round(latencyMs * 100) / 100, unit: 'Milliseconds' },
    }
    const listing = business as { listed: number; lowStock: number } | null
    if (listing) {
      metrics.ProductsListed = { value: listing.listed, unit: 'Count' }
      metrics.LowStockProductsListed = { value: listing.lowStock, unit: 'Count' }
    }
    emit(
      buildEmf(APP_TRACK, metrics, {
        Version: APP_VERSION,
        Instance: INSTANCE_ID,
        Method: req.method,
        Route: req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched',
        Status: status,
      }),
    )
  })

  next()
}

// ---- Saturacion: CPU y memoria de esta tarea, respecto a lo que tiene asignado ----

// cpuMicros: tiempo de CPU consumido en el intervalo; vcpu: p. ej. 0.25 para 256 unidades
export function computeCpuPercent(cpuMicros: number, elapsedMicros: number, vcpu: number): number {
  if (elapsedMicros <= 0 || vcpu <= 0) return 0
  return Math.round((cpuMicros / elapsedMicros / vcpu) * 10000) / 100
}

// TASK_CPU_UNITS y TASK_MEMORY_MB los inyecta el pipeline de release en la task definition
export function startResourceSampler(intervalMs = 10_000): NodeJS.Timeout | undefined {
  if (!METRICS_ENABLED) return undefined
  const cpuUnits = Number(process.env.TASK_CPU_UNITS ?? 0)
  const memoryMb = Number(process.env.TASK_MEMORY_MB ?? 0)
  const vcpu = cpuUnits > 0 ? cpuUnits / 1024 : os.availableParallelism()

  let lastUsage = process.cpuUsage()
  let lastTime = process.hrtime.bigint()

  const timer = setInterval(() => {
    const now = process.hrtime.bigint()
    const usage = process.cpuUsage(lastUsage)
    const elapsedMicros = Number(now - lastTime) / 1e3
    lastUsage = process.cpuUsage()
    lastTime = now

    const rss = process.memoryUsage().rss
    const metrics: MetricValues = {
      CpuPercent: { value: computeCpuPercent(usage.user + usage.system, elapsedMicros, vcpu), unit: 'Percent' },
    }
    if (memoryMb > 0) {
      metrics.MemoryPercent = { value: Math.round((rss / (memoryMb * 1024 * 1024)) * 10000) / 100, unit: 'Percent' }
    }
    emit(buildEmf(APP_TRACK, metrics, { Version: APP_VERSION, Instance: INSTANCE_ID }))
  }, intervalMs)
  timer.unref()
  return timer
}
