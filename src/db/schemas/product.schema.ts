import { pgTable, uuid, text, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import { commerce } from './commerce.schema.ts'

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  shortName: text('short_name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 9, scale: 2 }).notNull(),
  amountAvailable: integer('amount_available').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  commerceNit: text('commerce_nit')
    .notNull()
    .references(() => commerce.nit, { onDelete: 'cascade', onUpdate: 'restrict' }),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert