import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'

export const commerce = pgTable('commerce', {
  nit: integer('nit').primaryKey(),
  legalName: text('legal_name').notNull(),
  shortName: text('short_name').notNull(),
  address: text('address').notNull(),
  contactNumber: text('contact_number').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Commerce = typeof commerce.$inferSelect
export type NewCommerce = typeof commerce.$inferInsert