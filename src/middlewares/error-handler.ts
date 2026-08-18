import type { Request, Response, NextFunction } from 'express'
import { BadRequestError, ConflictError, NotFoundError } from '../shared/errors.ts'


export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err)

  if (err instanceof NotFoundError) return res.status(404).json({ message: err.message })
  if (err instanceof ConflictError) return res.status(409).json({ message: err.message })
  if (err instanceof BadRequestError) return res.status(400).json({ message: err.message })

  return res.status(500).json({ message: 'Error interno del servidor' })
}