import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  return res.status(500).json({ traceId: req.traceId, error: 'error interno del orquestador' });
}