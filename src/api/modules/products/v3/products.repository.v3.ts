import { db } from '../../../../db/connection.ts'
import { productsV3, type NewProductV3, type ProductV3 } from '../../../../db/schemas/product.schema.v3.ts'
import { eq, gte, ilike, and, lte, type SQL } from 'drizzle-orm'

type UpdateProductData = Partial<Omit<NewProductV3, 'id' | 'createdAt'>>

export interface ProductSearchFiltersV3 {
  shortName?: string
  fullName?: string
  category?: string // NUEVO en v3
  commerceNit?: number
  minPrice?: number
  maxPrice?: number
  minAmountAvailable?: number
  maxAmountAvailable?: number
}

export const productsRepositoryV3 = {
  async findAll(): Promise<ProductV3[]> {
    return db.select().from(productsV3)
  },

  async findByCommerce(commerceNit: number): Promise<ProductV3[]> {
    return db.select().from(productsV3).where(eq(productsV3.commerceNit, commerceNit))
  },

  async findById(id: string): Promise<ProductV3 | undefined> {
    const [product] = await db.select().from(productsV3).where(eq(productsV3.id, id))
    return product
  },

  async search(filters: ProductSearchFiltersV3): Promise<ProductV3[]> {
    const conditions: SQL[] = []

    if (filters.shortName) conditions.push(ilike(productsV3.shortName, `%${filters.shortName}%`))
    if (filters.fullName) conditions.push(ilike(productsV3.fullName, `%${filters.fullName}%`))
    if (filters.category) conditions.push(ilike(productsV3.category, `%${filters.category}%`))
    if (filters.commerceNit) conditions.push(eq(productsV3.commerceNit, filters.commerceNit))
    if (filters.minPrice !== undefined) conditions.push(gte(productsV3.price, String(filters.minPrice)))
    if (filters.maxPrice !== undefined) conditions.push(lte(productsV3.price, String(filters.maxPrice)))
    if (filters.minAmountAvailable !== undefined) conditions.push(gte(productsV3.amountAvailable, filters.minAmountAvailable))
    if (filters.maxAmountAvailable !== undefined) conditions.push(lte(productsV3.amountAvailable, filters.maxAmountAvailable))

    if (conditions.length === 0) return db.select().from(productsV3)

    return db.select().from(productsV3).where(and(...conditions))
  },

  async create(data: NewProductV3): Promise<ProductV3> {
    const [row] = await db.insert(productsV3).values(data).returning()
    return row
  },

  async update(id: string, data: UpdateProductData): Promise<ProductV3 | undefined> {
    const [row] = await db.update(productsV3).set(data).where(eq(productsV3.id, id)).returning()
    return row
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(productsV3).where(eq(productsV3.id, id)).returning({ id: productsV3.id })
    return result.length > 0
  },
}