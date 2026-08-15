import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  shipAddress: text('ship_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert