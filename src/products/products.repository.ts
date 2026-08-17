import { db } from "../db/connection.ts"
import { products, type NewProduct, type Product } from "../db/schemas/product.schema.ts"
import { eq, gte, ilike, and, lte, SQL } from "drizzle-orm"

type UpdateProductData = Partial<Omit<NewProduct, 'id' | 'createdAt'>>

export interface ProductSearchFilters {
  shortName?: string
  fullName?: string
  commerceNit?: string
  minPrice?: number
  maxPrice?: number
  minAmountAvailable?: number
  maxAmountAvailable?: number
}

export const productsRepository = {
  async findAll() {
    return db.select().from(products)
  },

  async findByCommerce(commerceNit: string) {
    return db.select().from(products).where(eq(products.commerceNit, commerceNit))
  },    

  async findById(id: string) {
    const [product] = await db.select().from(products).where(eq(products.id, id))
    return product
  },

  async search(filters: ProductSearchFilters): Promise<Product[]> {
    const conditions: SQL[] = []

    filters.shortName && conditions.push(ilike(products.shortName, `%${filters.shortName}%`))
    filters.fullName && conditions.push(ilike(products.fullName, `%${filters.fullName}%`))
    filters.commerceNit && conditions.push(eq(products.commerceNit, filters.commerceNit))
    filters.minPrice !== undefined && conditions.push(gte(products.price, String(filters.minPrice)))
    filters.maxPrice !== undefined && conditions.push(lte(products.price, String(filters.maxPrice)))
    filters.minAmountAvailable !== undefined && conditions.push(gte(products.amountAvailable, filters.minAmountAvailable))
    filters.maxAmountAvailable !== undefined && conditions.push(lte(products.amountAvailable, filters.maxAmountAvailable))

    if (conditions.length === 0) return db.select().from(products)

    return db.select().from(products).where(and(...conditions))
  },

  async create(data: NewProduct): Promise<Product> {
    const [row] = await db.insert(products).values(data).returning()
    return row
  },

  async update(id: string, data: UpdateProductData): Promise<Product | undefined> {
    const [row] = await db.update(products).set(data).where(eq(products.id, id)).returning()
    return row
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id })
    return result.length > 0
  },

}