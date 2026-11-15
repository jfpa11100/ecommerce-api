import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-inject-fault';

function readNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function faultInjection(req: Request, res: Response, next: NextFunction): void {
  if (process.env.FAULT_HEADER_ENABLED !== 'true') return next();
  if (req.path === '/health') return next(); // nunca afecta a la ruta de salud

  // if exists CHAOS_TOKEN, the request must send it
  const token = process.env.CHAOS_TOKEN;
  if (token && req.header('x-chaos-token') !== token) return next();

  const fault = req.header(HEADER)?.toLowerCase();
  if (fault !== 'error' && fault !== 'latency') return next();

  if (fault === 'latency') {
    const ms = clamp(readNumber(process.env.FAULT_LATENCY_MS, 0), 0, 10000);
    console.log(JSON.stringify({ chaos: true, fault, latencyMs: ms, path: req.path, traceId: req.traceId }));
    setTimeout(next, ms);
    return;
  }

  const rate = clamp(readNumber(process.env.FAULT_ERROR_RATE, 1), 0, 1);
  if (Math.random() < rate) {
    console.log(JSON.stringify({ chaos: true, fault, rate, path: req.path, traceId: req.traceId }));
    res.status(500).json({ error: 'fault-injected' });
    return;
  }
  next();
}