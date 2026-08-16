import type { Request, Response, NextFunction } from 'express'
import { commerceService } from './commerce.service.ts'

const getNitParam = (nit: string | string[] | undefined): string => {
  if (Array.isArray(nit)) return nit[0]
  return nit ?? ''
}

export const commerceController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await commerceService.getAll())
    } catch (err) {
      next(err)
    }
  },

  async getByNit(req: Request, res: Response, next: NextFunction) {
    try {
      const nit = getNitParam(req.params.nit)
      res.json(await commerceService.getByNit(nit))
    } catch (err) {
      next(err)
    }
  },

  async queryCommerce(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await commerceService.searchCommerce(req.body ?? {}))
      } catch (err) {
        next(err)
      }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await commerceService.create(req.body))
    } catch (err) {
      next(err)
    }
  },

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const nit = getNitParam(req.params.nit)
      res.json(await commerceService.replace(nit, req.body))
    } catch (err) {
      next(err)
    }
  },

  async patch(req: Request, res: Response, next: NextFunction) {
    try {
      const nit = getNitParam(req.params.nit)
      res.json(await commerceService.patch(nit, req.body))
    } catch (err) {
      next(err)
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const nit = getNitParam(req.params.nit)
      await commerceService.delete(nit)
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
}