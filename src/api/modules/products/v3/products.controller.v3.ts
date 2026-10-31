import type { NextFunction, Request, Response } from 'express'
import { productsServiceV3 } from './products.service.v3.ts'
import { externalApiService } from '../../external-api.service.ts'

const getIdParam = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0]
  return id ?? ''
}

// Mismas cabeceras que reenvia v2 hacia los otros clusters
const getForwardHeaders = (req: Request): HeadersInit => {
  const traceId = req.headers['x-trace-id']
  return {
    authorization: req.headers.authorization ?? '',
    'x-trace-id': Array.isArray(traceId) ? traceId[0] : (traceId ?? ''),
  }
}

export const productsControllerV3 = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { commerceNit } = req.query
      if (commerceNit) {
        return res.json(await productsServiceV3.getByCommerce(Number(commerceNit)))
      }
      res.json(await productsServiceV3.getAll())
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getIdParam(req.params.id)
      const forwardHeaders = getForwardHeaders(req)

      const [product, clusterGCP, clusterOCI] = await Promise.all([
        productsServiceV3.getById(id),
        externalApiService.getData(process.env.GCP_CLUSTER_URL!, 'predicciones', forwardHeaders),
        externalApiService.getData(process.env.OCI_CLUSTER_URL!, 'trades', forwardHeaders),
      ])
      res.json({ product, clusterGCP, clusterOCI })
    } catch (err) {
      next(err)
    }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await productsServiceV3.search(req.body ?? {}))
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await productsServiceV3.create(req.body))
    } catch (err) {
      next(err)
    }
  },

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await productsServiceV3.replace(getIdParam(req.params.id), req.body))
    } catch (err) {
      next(err)
    }
  },

  async patch(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await productsServiceV3.patch(getIdParam(req.params.id), req.body))
    } catch (err) {
      next(err)
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await productsServiceV3.delete(getIdParam(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
}
