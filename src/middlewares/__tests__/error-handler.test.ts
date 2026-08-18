import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from '../error-handler.ts'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors.ts'

function createMockRes() {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

let res: Response
let req: Request
let next: NextFunction
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  res = createMockRes()
  req = {} as Request
  next = vi.fn()
  // silence and spy on console.error so test output stays clean
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('errorHandler', () => {
  it('responds 404 with the message when the error is a NotFoundError', () => {
    const error = new NotFoundError('Client not found')

    errorHandler(error, req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Client not found' })
  })

  it('responds 409 with the message when the error is a ConflictError', () => {
    const error = new ConflictError('Email already exists')

    errorHandler(error, req, res, next)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ message: 'Email already exists' })
  })

  it('responds 400 with the message when the error is a BadRequestError', () => {
    const error = new BadRequestError('Price must be greater than 0')

    errorHandler(error, req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Price must be greater than 0' })
  })

  it('responds 500 with a generic message when the error is not a known custom error', () => {
    const error = new Error('Something exploded')

    errorHandler(error, req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ message: 'Error interno del servidor' })
  })

  it('logs the error regardless of its type', () => {
    const error = new NotFoundError('Client not found')

    errorHandler(error, req, res, next)

    expect(consoleErrorSpy).toHaveBeenCalledWith(error)
  })

  it('never calls next, since it is the final handler in the chain', () => {
    const error = new BadRequestError('Invalid data')

    errorHandler(error, req, res, next)

    expect(next).not.toHaveBeenCalled()
  })
})