import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/connection.ts'
import { clients, type NewClient } from '../../db/schemas/client.schema.ts'
import { clientsRepository } from '../clients.repository.ts'

const baseClient = (overrides: Partial<NewClient> = {}): NewClient => ({
  name: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'hashed-password-1',
  shipAddress: '123 Main St',
  ...overrides,
})

async function cleanTable() {
  await db.delete(clients)
}

beforeEach(async () => {
  await cleanTable()
})

afterAll(async () => {
  await cleanTable()
})

describe('clientsRepository.findAll', () => {
  it('returns an empty array when there are no clients', async () => {
    const result = await clientsRepository.findAll()
    expect(result).toEqual([])
  })

  it('returns all clients without the password field', async () => {
    await db.insert(clients).values([
      baseClient({ email: 'john@example.com' }),
      baseClient({ email: 'jane@example.com', name: 'Jane', lastName: 'Smith' }),
    ])

    const result = await clientsRepository.findAll()

    expect(result).toHaveLength(2)
    for (const client of result) {
      expect(client).not.toHaveProperty('password')
    }
    expect(result.map((c) => c.email).sort()).toEqual(['jane@example.com', 'john@example.com'])
  })
})

describe('clientsRepository.findById', () => {
  it('returns the client without the password field when it exists', async () => {
    const [inserted] = await db.insert(clients).values(baseClient()).returning()

    const result = await clientsRepository.findById(inserted.id)

    expect(result).toBeDefined()
    expect(result?.id).toBe(inserted.id)
    expect(result?.email).toBe('john@example.com')
    expect(result).not.toHaveProperty('password')
  })

  it('returns undefined when the client does not exist', async () => {
    const result = await clientsRepository.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeUndefined()
  })
})

describe('clientsRepository.findByEmail', () => {
  it('returns the client without the password field when the email exists', async () => {
    await db.insert(clients).values(baseClient({ email: 'john@example.com' }))

    const result = await clientsRepository.findByEmail('john@example.com')

    expect(result).toBeDefined()
    expect(result?.email).toBe('john@example.com')
    expect(result).not.toHaveProperty('password')
  })

  it('returns undefined when the email does not exist', async () => {
    const result = await clientsRepository.findByEmail('missing@example.com')
    expect(result).toBeUndefined()
  })
})

describe('clientsRepository.search', () => {
  beforeEach(async () => {
    await db.insert(clients).values([
      baseClient({
        name: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        createdAt: new Date('2023-01-10'),
      }),
      baseClient({
        name: 'Johnny',
        lastName: 'Appleseed',
        email: 'johnny@example.com',
        createdAt: new Date('2023-06-15'),
      }),
      baseClient({
        name: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        createdAt: new Date('2024-02-20'),
      }),
    ])
  })

  it('returns all clients when no filters are provided', async () => {
    const result = await clientsRepository.search({})
    expect(result).toHaveLength(3)
  })

  it('filters by partial, case-insensitive name', async () => {
    const result = await clientsRepository.search({ name: 'john' })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.name).sort()).toEqual(['John', 'Johnny'])
  })

  it('filters by partial lastName', async () => {
    const result = await clientsRepository.search({ lastName: 'smith' })
    expect(result).toHaveLength(1)
    expect(result[0].lastName).toBe('Smith')
  })

  it('filters by partial email', async () => {
    const result = await clientsRepository.search({ email: 'doe' })
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('john.doe@example.com')
  })

  it('filters by createdFrom', async () => {
    const result = await clientsRepository.search({ createdFrom: '2023-06-01' })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.name).sort()).toEqual(['Jane', 'Johnny'])
  })

  it('filters by createdTo', async () => {
    const result = await clientsRepository.search({ createdTo: '2023-06-01' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('John')
  })

  it('combines multiple filters with AND semantics', async () => {
    const result = await clientsRepository.search({
      name: 'john',
      createdFrom: '2023-05-01',
      createdTo: '2023-12-31',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Johnny')
  })

  it('returns an empty array when no client matches the filters', async () => {
    const result = await clientsRepository.search({ name: 'nonexistent' })
    expect(result).toEqual([])
  })
})

describe('clientsRepository.create', () => {
  it('creates the client and returns it without the password field', async () => {
    const result = await clientsRepository.create(baseClient({ email: 'new@example.com' }))

    expect(result).not.toHaveProperty('password')
    expect(result.email).toBe('new@example.com')
    expect(result.id).toBeDefined()

    const [inDb] = await db.select().from(clients).where(eq(clients.id, result.id))
    expect(inDb.password).toBe('hashed-password-1')
  })
})

describe('clientsRepository.update', () => {
  it('updates and returns the client (including password) when it exists', async () => {
    const [inserted] = await db.insert(clients).values(baseClient()).returning()

    const result = await clientsRepository.update(inserted.id, { name: 'Updated Name' })

    expect(result).toBeDefined()
    expect(result?.name).toBe('Updated Name')
    expect(result?.email).toBe('john@example.com')
  })

  it('returns undefined when the client does not exist', async () => {
    const result = await clientsRepository.update('00000000-0000-0000-0000-000000000000', {
      name: 'Ghost',
    })
    expect(result).toBeUndefined()
  })
})

describe('clientsRepository.delete', () => {
  it('deletes the client and returns true when it exists', async () => {
    const [inserted] = await db.insert(clients).values(baseClient()).returning()

    const result = await clientsRepository.delete(inserted.id)

    expect(result).toBe(true)
    const [remaining] = await db.select().from(clients).where(eq(clients.id, inserted.id))
    expect(remaining).toBeUndefined()
  })

  it('returns false when the client does not exist', async () => {
    const result = await clientsRepository.delete('00000000-0000-0000-0000-000000000000')
    expect(result).toBe(false)
  })
})