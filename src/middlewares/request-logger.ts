import type { NextFunction, Request, Response } from 'express';

function apiVersion(path: string): string {
  const match = path.match(/^\/api\/(v\d+)(?:\/|$)/);
  return match ? match[1] : '-';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  let logged = false;

  const log = (): void => {
    if (logged) return;
    logged = true;

    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const route = req.originalUrl.split('?')[0];

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(), // always UTC (ends with "Z")
        api: apiVersion(route),
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