import type { Request, Response, NextFunction } from 'express'
import { logger } from '../shared/logger.ts';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Error no controlado', { traceId: req.traceId, error: String(err) });
  return res.status(500).json({ traceId: req.traceId, error: 'error interno del orquestador' });
}