import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-trace-id'];
  req.traceId = typeof incoming === 'string' && incoming.length > 0
    ? incoming
    : randomUUID();
    
  res.setHeader('x-trace-id', req.traceId);
  next();
}