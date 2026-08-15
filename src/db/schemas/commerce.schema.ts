import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const commerce = pgTable('commerce', {
  nit: varchar('nit', { length: 10 }).primaryKey(),
  legalName: text('legal_name').notNull(),
  shortName: text('short_name').notNull(),
  address: text('address'),
  contactNumber: text('contact_number'),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Commerce = typeof commerce.$inferSelect
export type NewCommerce = typeof commerce.$inferInsert