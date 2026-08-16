import { eq, getTableColumns } from 'drizzle-orm'
import { clients, type Client, type NewClient, type ResponseClient } from '../db/schemas/client.schema.ts'
import { db } from '../db/connection.ts'

const { password: _, ...clientResponseColumns } = getTableColumns(clients)

export const clientsRepository = {
  async findAll(): Promise<ResponseClient[]> {
    return db.select(clientResponseColumns).from(clients)
  },

  async findById(id: string): Promise<ResponseClient | undefined> {
    const [client] = await db.select(clientResponseColumns).from(clients).where(eq(clients.id, id))
    return client
  },

  async findByEmail(email: string): Promise<ResponseClient | undefined> {
    const [client] = await db.select(clientResponseColumns).from(clients).where(eq(clients.email, email))
    return client
  },

  async create(data: NewClient): Promise<ResponseClient> {
    const clientResult = await db.insert(clients).values(data).returning()
    const {password: _, ...client} = clientResult[0]
    return client
  },
}