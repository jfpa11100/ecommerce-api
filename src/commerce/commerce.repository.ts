import { eq, gte, ilike, and, lte, SQL } from 'drizzle-orm'
import { commerce, type Commerce, type NewCommerce } from '../db/schemas/commerce.schema.ts'
import { db } from '../db/connection.ts'

type UpdateCommerceData = Partial<Omit<NewCommerce, 'nit' | 'createdAt'>>
export type CommerceSearchFilters = {
  shortName?: string
  legalName?: string
  address?: string
  email?: string
  createdFrom?: string // ISO date
  createdTo?: string   // ISO date
}

export const commerceRepository = {
  async findAll(): Promise<Commerce[]> {
    return db.select().from(commerce)
  },

  async findByNit(nit: string): Promise<Commerce | undefined> {
    const [row] = await db.select().from(commerce).where(eq(commerce.nit, nit))
    return row
  },

  async search(filters: CommerceSearchFilters): Promise<Commerce[]> {
    const conditions: SQL[] = []
    
    if (filters.legalName) conditions.push(ilike(commerce.legalName, `%${filters.legalName}%`))
    if (filters.shortName) conditions.push(ilike(commerce.shortName, `%${filters.shortName}%`))
    if (filters.email) conditions.push(ilike(commerce.email, `%${filters.email}%`))
    if (filters.address) conditions.push(ilike(commerce.address, `%${filters.address}%`))
    if (filters.createdFrom) conditions.push(gte(commerce.createdAt, new Date(filters.createdFrom)))
    if (filters.createdTo) conditions.push(lte(commerce.createdAt, new Date(filters.createdTo)))

    if (conditions.length === 0) return db.select().from(commerce)

    return db.select().from(commerce).where(and(...conditions))
  },

  async create(data: NewCommerce): Promise<Commerce> {
    const [row] = await db.insert(commerce).values(data).returning()
    return row
  },

  async update(nit: string, data: UpdateCommerceData): Promise<Commerce | undefined> {
    const [row] = await db.update(commerce).set(data).where(eq(commerce.nit, nit)).returning()
    return row
  },

  async delete(nit: string): Promise<boolean> {
    const result = await db.delete(commerce).where(eq(commerce.nit, nit)).returning({ nit: commerce.nit })
    return result.length > 0
  },
}