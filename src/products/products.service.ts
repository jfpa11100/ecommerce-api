import { commerceRepository } from "../commerce/commerce.repository.ts"
import type { NewProduct } from "../db/schemas/product.schema.ts"
import { BadRequestError, NotFoundError } from "../shared/errors.ts"
import { productsRepository, type ProductSearchFilters } from "./products.repository.ts"

export const productsService = {
  async getAll() {
    return productsRepository.findAll()
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async getByCommerce(commerceNit: number) {
    const commerceExists = await commerceRepository.findByNit(commerceNit)
    if (!commerceExists) throw new NotFoundError('Commerce not found')
    return productsRepository.findByCommerce(commerceNit)
  },

  async search(filters: ProductSearchFilters) {
    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      throw new BadRequestError("minPrice can't be greater than maxPrice")
    }

    if (
      filters.minAmountAvailable !== undefined &&
      filters.maxAmountAvailable !== undefined &&
      filters.minAmountAvailable > filters.maxAmountAvailable
    ) {
      throw new BadRequestError("minAmountAvailable can't be greater than maxAmountAvailable")
    }

    if (filters.commerceNit) {
      const commerceExists = await commerceRepository.findByNit(filters.commerceNit)
      if (!commerceExists) throw new BadRequestError('The commerce with the provided NIT does not exist')
    }

    return productsRepository.search(filters)
  },

  async create(data: NewProduct) {
    if (!data.commerceNit) {
      throw new BadRequestError('Commerce NIT is required')
    }
    const commerceExists = await commerceRepository.findByNit(data.commerceNit)
    if (!commerceExists) throw new BadRequestError('Commerce with NIT not found')
    if (Number(data.price) <= 0) throw new BadRequestError('Price must be greater than 0')
    return productsRepository.create(data)
  },

  async replace(id: string, data: Required<Omit<NewProduct, 'id' | 'createdAt'>>) {
    if (!data.shortName || !data.fullName || !data.description || !data.price || !data.amountAvailable || !data.commerceNit) {
      throw new BadRequestError('Need to provide all fields for replacement')
    }
    const product = await productsRepository.update(id, data)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async patch(id: string, data: Partial<Omit<NewProduct, 'id' | 'createdAt'>>) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('There are no fields to update')
    }
    const product = await productsRepository.update(id, data)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async delete(id: string) {
    const deleted = await productsRepository.delete(id)
    if (!deleted) throw new NotFoundError('Product not found')
  },

}