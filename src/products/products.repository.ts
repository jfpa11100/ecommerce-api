import { db } from "../db/connection.ts"
import { products, type NewProduct, type Product } from "../db/schemas/product.schema.ts"
import { eq } from "drizzle-orm"

type UpdateProductData = Partial<Omit<NewProduct, 'id' | 'createdAt'>>

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