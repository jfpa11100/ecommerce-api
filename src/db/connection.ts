import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL environment variable is not set')

if (!process.env.IS_PRODUCTION)
  throw new Error('IS_PRODUCTION environment variable is not set')

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client);