import { pgTable, uuid, text, timestamp, pgSchema } from 'drizzle-orm/pg-core'

const tab = process.env.IS_PRODUCTION === 'true' ? pgTable : pgSchema('test_db').table as unknown as typeof pgTable

export const clients = tab('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  shipAddress: text('ship_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Client = typeof clients.$inferSelect
export type ResponseClient = Omit<Client, 'password'>
export type NewClient = typeof clients.$inferInsert