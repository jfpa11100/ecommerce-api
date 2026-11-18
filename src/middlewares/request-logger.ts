import { httpDuration, httpActive } from '../telemetry/otel.ts';
import type { NextFunction, Request, Response } from 'express';

function apiVersion(path: string): string {
  const match = path.match(/^\/api\/(v\d+)(?:\/|$)/);
  return match ? match[1] : '-';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') return next();
  const start = process.hrtime.bigint();
  let logged = false;
  httpActive.add(1);

  const log = (): void => {
    if (logged) return;
    logged = true;

    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const route = req.originalUrl.split('?')[0];

    const routeLabel = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    httpActive.add(-1);
    httpDuration.record(ms / 1000, {
      'http.request.method': req.method,
      'http.route': routeLabel,
      'http.response.status_code': res.statusCode,
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(), // always UTC (ends with "Z")
        api: 'pipe',
        traceId: req.traceId,
        method: req.method,
        route,
        status: res.statusCode,
        ms: Number(ms.toFixed(2)),
        ...(res.writableFinished ? {} : { aborted: true }),
      }),
    );
  };

  res.on('finish', log);
  res.on('close', log); // clients that cut the connection (k6 timeouts)
  next();
}