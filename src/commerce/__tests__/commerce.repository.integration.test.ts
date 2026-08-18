import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/connection.ts'
import { commerce, type NewCommerce } from '../../db/schemas/commerce.schema.ts'
import { commerceRepository } from '../../commerce/commerce.repository.ts'

const baseCommerce = (overrides: Partial<NewCommerce> = {}): NewCommerce => ({
  nit: 123456789,
  legalName: 'ACME Corp',
  shortName: 'ACME',
  address: 'Main St 123',
  contactNumber: '3000000000',
  email: 'contact@acme.com',
  ...overrides,
})

async function cleanTable() {
  await db.delete(commerce)
}

beforeEach(async () => {
  await cleanTable()
})

afterAll(async () => {
  await cleanTable()
})

describe('commerceRepository.findAll', () => {
  it('returns an empty array when there are no commerces', async () => {
    const result = await commerceRepository.findAll()
    expect(result).toEqual([])
  })

  it('returns all commerces', async () => {
    await db.insert(commerce).values([
      baseCommerce({ nit: 111111111, email: 'one@acme.com' }),
      baseCommerce({ nit: 222222222, email: 'two@acme.com', legalName: 'Second Corp' }),
    ])

    const result = await commerceRepository.findAll()

    expect(result).toHaveLength(2)
    expect(result.map((c) => c.nit).sort()).toEqual([111111111, 222222222])
  })
})

describe('commerceRepository.findByNit', () => {
  it('returns the commerce when it exists', async () => {
    await db.insert(commerce).values(baseCommerce({ nit: 123456789 }))

    const result = await commerceRepository.findByNit(123456789)

    expect(result).toBeDefined()
    expect(result?.nit).toBe(123456789)
    expect(result?.legalName).toBe('ACME Corp')
  })

  it('returns undefined when the nit does not exist', async () => {
    const result = await commerceRepository.findByNit(999999999)
    expect(result).toBeUndefined()
  })
})

describe('commerceRepository.search', () => {
  beforeEach(async () => {
    await db.insert(commerce).values([
      baseCommerce({
        nit: 111111111,
        legalName: 'ACME Corp',
        shortName: 'ACME',
        address: 'Main St 123',
        email: 'contact@acme.com',
        createdAt: new Date('2023-01-10'),
      }),
      baseCommerce({
        nit: 222222222,
        legalName: 'ACME Distribution',
        shortName: 'ACME Dist',
        address: 'Second Ave 45',
        email: 'sales@acmedist.com',
        createdAt: new Date('2023-06-15'),
      }),
      baseCommerce({
        nit: 333333333,
        legalName: 'Other Company',
        shortName: 'OtherCo',
        address: 'Third Blvd 9',
        email: 'info@otherco.com',
        createdAt: new Date('2024-02-20'),
      }),
    ])
  })

  it('returns all commerces when no filters are provided', async () => {
    const result = await commerceRepository.search({})
    expect(result).toHaveLength(3)
  })

  it('filters by partial, case-insensitive legalName', async () => {
    const result = await commerceRepository.search({ legalName: 'acme' })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.nit).sort()).toEqual([111111111, 222222222])
  })

  it('filters by partial shortName', async () => {
    const result = await commerceRepository.search({ shortName: 'OtherCo' })
    expect(result).toHaveLength(1)
    expect(result[0].nit).toBe(333333333)
  })

  it('filters by partial email', async () => {
    const result = await commerceRepository.search({ email: 'acmedist' })
    expect(result).toHaveLength(1)
    expect(result[0].nit).toBe(222222222)
  })

  it('filters by partial address', async () => {
    const result = await commerceRepository.search({ address: 'Third' })
    expect(result).toHaveLength(1)
    expect(result[0].nit).toBe(333333333)
  })

  it('filters by createdFrom', async () => {
    const result = await commerceRepository.search({ createdFrom: '2023-06-01' })
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.nit).sort()).toEqual([222222222, 333333333])
  })

  it('filters by createdTo', async () => {
    const result = await commerceRepository.search({ createdTo: '2023-06-01' })
    expect(result).toHaveLength(1)
    expect(result[0].nit).toBe(111111111)
  })

  it('combines multiple filters with AND semantics', async () => {
    const result = await commerceRepository.search({
      legalName: 'acme',
      createdFrom: '2023-05-01',
      createdTo: '2023-12-31',
    })
    expect(result).toHaveLength(1)
    expect(result[0].nit).toBe(222222222)
  })

  it('returns an empty array when no commerce matches the filters', async () => {
    const result = await commerceRepository.search({ legalName: 'nonexistent' })
    expect(result).toEqual([])
  })
})

describe('commerceRepository.create', () => {
  it('creates the commerce and returns it', async () => {
    const result = await commerceRepository.create(baseCommerce({ nit: 444444444 }))

    expect(result.nit).toBe(444444444)
    expect(result.legalName).toBe('ACME Corp')

    const [inDb] = await db.select().from(commerce).where(eq(commerce.nit, 444444444))
    expect(inDb).toBeDefined()
  })
})

describe('commerceRepository.update', () => {
  it('updates and returns the commerce when it exists', async () => {
    await db.insert(commerce).values(baseCommerce({ nit: 123456789 }))

    const result = await commerceRepository.update(123456789, { address: 'New Address' })

    expect(result).toBeDefined()
    expect(result?.address).toBe('New Address')
    expect(result?.legalName).toBe('ACME Corp')
  })

  it('returns undefined when the commerce does not exist', async () => {
    const result = await commerceRepository.update(999999999, { address: 'Ghost' })
    expect(result).toBeUndefined()
  })
})

describe('commerceRepository.delete', () => {
  it('deletes the commerce and returns true when it exists', async () => {
    await db.insert(commerce).values(baseCommerce({ nit: 123456789 }))

    const result = await commerceRepository.delete(123456789)

    expect(result).toBe(true)
    const [remaining] = await db.select().from(commerce).where(eq(commerce.nit, 123456789))
    expect(remaining).toBeUndefined()
  })

  it('returns false when the commerce does not exist', async () => {
    const result = await commerceRepository.delete(999999999)
    expect(result).toBe(false)
  })
})