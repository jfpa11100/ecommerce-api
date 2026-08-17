import type { NextFunction, Request, Response } from "express";
import { productsService } from "./products.service.ts";

const getIdParam = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) return id[0];
  return id ?? "";
};

export const productsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { commerceNit } = req.query;
      if (commerceNit && typeof commerceNit === "string") {
        return res.json(await productsService.getByCommerce(commerceNit));
      }
      res.json(await productsService.getAll());
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getIdParam(req.params.id);
      res.json(await productsService.getById(id));
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await productsService.search(req.body ?? {}))
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await productsService.create(req.body));
    } catch (err) {
      next(err);
    }
  },

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getIdParam(req.params.id);
      res.json(await productsService.replace(id, req.body));
    } catch (err) {
      next(err);
    }
  },

  async patch(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getIdParam(req.params.id);
      res.json(await productsService.patch(id, req.body));
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getIdParam(req.params.id);
      await productsService.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
