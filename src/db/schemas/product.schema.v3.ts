import { pgTable, uuid, text, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import { commerce } from './commerce.schema.ts'

// Misma tabla "products" que product.schema.ts
// Se agrega en la fase EXPAND (category, NULLABLE). v1 y v2 siguen usando
export const productsV3 = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  shortName: text('short_name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 9, scale: 2 }).notNull(),
  amountAvailable: integer('amount_available').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  commerceNit: integer('commerce_nit')
    .notNull()
    .references(() => commerce.nit, { onDelete: 'cascade', onUpdate: 'restrict' }),
  category: text('category'),
})

export type ProductV3 = typeof productsV3.$inferSelect
export type NewProductV3 = typeof productsV3.$inferInsert