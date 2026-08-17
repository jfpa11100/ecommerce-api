import { db } from "../db/connection.ts"
import { products, type NewProduct, type Product } from "../db/schemas/product.schema.ts"
import { eq } from "drizzle-orm"

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

}