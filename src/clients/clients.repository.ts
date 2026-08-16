import { eq } from 'drizzle-orm'
import { clients, type Client, type NewClient } from '../db/schemas/client.schema.ts'
import { db } from '../db/connection.ts'

type UpdateClientData = Partial<Omit<NewClient, 'id' | 'createdAt'>>

export const clientsRepository = {
  async findAll(): Promise<Client[]> {
    return db.select().from(clients)
  },

  async findById(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id))
    return client
  },

  async findByEmail(email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.email, email))
    return client
  },

  async create(data: NewClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning()
    return client
  },
}