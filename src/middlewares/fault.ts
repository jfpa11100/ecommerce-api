import type { Request, Response, NextFunction } from 'express';

const ENABLED = process.env.CHAOS_ENABLED === 'true';
const TOKEN = process.env.CHAOS_TOKEN;

export function faultInjection(req: Request, res: Response, next: NextFunction) {
  if (!ENABLED || !TOKEN) return next();
  if (req.path === '/health') return next();              // no romper el health check del ALB
  if (req.header('x-chaos-token') !== TOKEN) return next();

  const fault = req.header('x-chaos-fault');              // "latency:500" | "error:503" | "error:500:0.3"
  if (!fault) return next();

  const [type, value, prob] = fault.split(':');
  if (prob && Math.random() > Number(prob)) return next();

  console.log(JSON.stringify({ chaos: true, type, value, path: req.path }));

  if (type === 'latency') {
    return void setTimeout(next, Math.min(Number(value) || 0, 10000));
  }
  if (type === 'error') {
    return void res.status(Number(value) || 500).json({ error: 'chaos-injected' });
  }
  next();
}