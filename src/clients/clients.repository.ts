import { eq, getTableColumns, gte, ilike, lte, and, type SQL } from 'drizzle-orm'
import { clients, type Client, type NewClient, type ResponseClient } from '../db/schemas/client.schema.ts'
import { db } from '../db/connection.ts'

const { password: _, ...clientResponseColumns } = getTableColumns(clients)

// To filter clients in "search" method
export interface ClientSearchFilters {
  name?: string
  lastName?: string
  email?: string
  createdFrom?: string // ISO date
  createdTo?: string   // ISO date
}

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

  async search(filters: ClientSearchFilters): Promise<ResponseClient[]> {
    const conditions: SQL[] = []

    if (filters.name) conditions.push(ilike(clients.name, `%${filters.name}%`))
    if (filters.lastName) conditions.push(ilike(clients.lastName, `%${filters.lastName}%`))
    if (filters.email) conditions.push(ilike(clients.email, `%${filters.email}%`))
    if (filters.createdFrom) conditions.push(gte(clients.createdAt, new Date(filters.createdFrom)))
    if (filters.createdTo) conditions.push(lte(clients.createdAt, new Date(filters.createdTo)))

    if (conditions.length === 0) return db.select(clientResponseColumns).from(clients)

    return db.select(clientResponseColumns).from(clients).where(and(...conditions))
  },

  async create(data: NewClient): Promise<ResponseClient> {
    const clientResult = await db.insert(clients).values(data).returning()
    const {password: _, ...client} = clientResult[0]
    return client
  },
}