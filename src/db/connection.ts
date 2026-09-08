import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs'

const environment = process.env.NODE_ENV || 'development';

if (environment !== 'production' && !process.env.DATABASE_URL) {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const envPath = path.resolve(dirname, '..', '..', `.env.${environment}`);
  dotenv.config({ path: envPath });
}

if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL environment variable is not set')

const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: { 
    rejectUnauthorized: true,
    ca: fs.readFileSync('./certs/us-east-2-bundle.pem', 'utf8'),
  }
})

export const db = drizzle(client);