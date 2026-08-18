import { pgTable, uuid, text, timestamp, numeric, integer, pgSchema } from 'drizzle-orm/pg-core'
import { commerce } from './commerce.schema.ts'

const tab = process.env.IS_PRODUCTION === 'true' ? pgTable : pgSchema('test_db').table as unknown as typeof pgTable

export const products = tab('products', {
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
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert