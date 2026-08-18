import type { NewCommerce } from "../db/schemas/commerce.schema.ts"
import { BadRequestError, ConflictError, NotFoundError } from "../shared/errors.ts"
import { commerceRepository, type CommerceSearchFilters } from "./commerce.repository.ts"

export const commerceService = {
  async getAll() {
    return commerceRepository.findAll()
  },

  async getByNit(nit: number) {
    const row = await commerceRepository.findByNit(nit)
    if (!row) throw new NotFoundError('Commerce not found')
    return row
  },

  async searchCommerce(filters: CommerceSearchFilters) {
      return commerceRepository.search(filters)
  },

  async create(data: NewCommerce) {
    const existing = await commerceRepository.findByNit(data.nit)
    if (existing) throw new ConflictError('Commerce with this NIT already exists')
    return commerceRepository.create(data)
  },

  async replace(nit: number, data: Required<Omit<NewCommerce, 'nit' | 'createdAt'>>) {
    const row = await commerceRepository.update(nit, data)
    if (!row) throw new NotFoundError('Commerce not found')
    return row
  },

  async patch(nit: number, data: Partial<Omit<NewCommerce, 'nit' | 'createdAt'>>) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('No fields provided for update')
    }
    const row = await commerceRepository.update(nit, data)
    if (!row) throw new NotFoundError('Commerce not found')
    return row
  },

  async delete(nit: number) {
    const deleted = await commerceRepository.delete(nit)
    if (!deleted) throw new NotFoundError('Commerce not found')
  },
}