import { pgSchema, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

const tab = process.env.IS_PRODUCTION === 'true' ? pgTable : pgSchema('test_db').table as unknown as typeof pgTable

export const commerce = tab('commerce', {
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