import { commerceRepository } from "../commerce/commerce.repository.ts"
import type { NewProduct } from "../db/schemas/product.schema.ts"
import { BadRequestError, NotFoundError } from "../shared/errors.ts"
import { productsRepository } from "./products.repository.ts"

export const productsService = {
  async getAll() {
    return productsRepository.findAll()
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async getByCommerce(commerceNit: string) {
    const commerceExists = await commerceRepository.findByNit(commerceNit)
    if (!commerceExists) throw new NotFoundError('Commerce not found')
    return productsRepository.findByCommerce(commerceNit)
  },

  async create(data: NewProduct) {
    const commerceExists = await commerceRepository.findByNit(data.commerceNit)
    if (!commerceExists) throw new BadRequestError('Commerce with NIT not found')
    if (Number(data.price) <= 0) throw new BadRequestError('Price must be greater than 0')
    return productsRepository.create(data)
  },

}