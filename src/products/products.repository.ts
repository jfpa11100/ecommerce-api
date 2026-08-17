import { db } from "../db/connection.ts"
import { products } from "../db/schemas/product.schema.ts"
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

}