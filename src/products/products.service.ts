import { commerceRepository } from "../commerce/commerce.repository.ts"
import { NotFoundError } from "../shared/errors.ts"
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

}