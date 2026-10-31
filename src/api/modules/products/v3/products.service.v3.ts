import { commerceRepository } from '../../commerce/commerce.repository.ts'
import { BadRequestError, NotFoundError } from '../../../../shared/errors.ts'
import type { NewProductV3 } from '../../../../db/schemas/product.schema.v3.ts'
import { productsRepositoryV3, type ProductSearchFiltersV3 } from './products.repository.v3.ts'

const DEFAULT_CATEGORY = 'general'
const MAX_CATEGORY_LENGTH = 50

// Cambio funcional de v3: "category" opcional, normalizada y con valor por defecto.
function normalizeCategory(category: unknown): string | undefined {
  if (category === undefined || category === null) return undefined
  if (typeof category !== 'string' || category.trim() === '') {
    throw new BadRequestError('Category must be a non-empty string')
  }
  if (category.trim().length > MAX_CATEGORY_LENGTH) {
    throw new BadRequestError(`Category can't exceed ${MAX_CATEGORY_LENGTH} characters`)
  }
  return category.trim().toLowerCase()
}

export const productsServiceV3 = {
  async getAll() {
    return productsRepositoryV3.findAll()
  },

  async getById(id: string) {
    const product = await productsRepositoryV3.findById(id)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async getByCommerce(commerceNit: number) {
    const commerceExists = await commerceRepository.findByNit(commerceNit)
    if (!commerceExists) throw new NotFoundError('Commerce not found')
    return productsRepositoryV3.findByCommerce(commerceNit)
  },

  async search(filters: ProductSearchFiltersV3) {
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

    return productsRepositoryV3.search(filters)
  },

  async create(data: NewProductV3) {
    if (!data.commerceNit) {
      throw new BadRequestError('Commerce NIT is required')
    }
    const commerceExists = await commerceRepository.findByNit(data.commerceNit)
    if (!commerceExists) throw new BadRequestError('Commerce with NIT not found')
    if (Number(data.price) <= 0) throw new BadRequestError('Price must be greater than 0')
    const category = normalizeCategory(data.category) ?? DEFAULT_CATEGORY
    return productsRepositoryV3.create({ ...data, category })
  },

  async replace(id: string, data: Required<Omit<NewProductV3, 'id' | 'createdAt' | 'category'>> & { category?: string | null }) {
    if (!data.shortName || !data.fullName || !data.description || !data.price || !data.amountAvailable || !data.commerceNit) {
      throw new BadRequestError('Need to provide all fields for replacement')
    }
    const category = normalizeCategory(data.category) ?? DEFAULT_CATEGORY
    const product = await productsRepositoryV3.update(id, { ...data, category })
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async patch(id: string, data: Partial<Omit<NewProductV3, 'id' | 'createdAt'>>) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('There are no fields to update')
    }
    const patchData = { ...data }
    if ('category' in patchData) patchData.category = normalizeCategory(patchData.category) ?? DEFAULT_CATEGORY
    const product = await productsRepositoryV3.update(id, patchData)
    if (!product) throw new NotFoundError('Product not found')
    return product
  },

  async delete(id: string) {
    const deleted = await productsRepositoryV3.delete(id)
    if (!deleted) throw new NotFoundError('Product not found')
  },
}
