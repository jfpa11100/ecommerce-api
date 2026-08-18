import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/connection.ts'
import { products, type NewProduct } from '../../db/schemas/product.schema.ts'
import { commerce, type NewCommerce } from '../../db/schemas/commerce.schema.ts'
import { productsRepository } from '../products.repository.ts'

// `products.commerceNit` is a foreign key to `commerce.nit`, so every test
// commerce must be inserted before the products that reference it, and
// cleaned up in the reverse order (products first, then commerce).

const baseCommerce = (overrides: Partial<NewCommerce> = {}): NewCommerce => ({
  nit: 111111111,
  legalName: 'ACME Corp',
  shortName: 'ACME',
  address: 'Main St 123',
  contactNumber: '3000000000',
  email: 'contact@acme.com',
  ...overrides,
})

const baseProduct = (overrides: Partial<NewProduct> = {}): NewProduct => ({
  shortName: 'Shirt',
  fullName: 'Blue Cotton Shirt',
  description: 'A comfortable blue shirt',
  price: '100.00',
  amountAvailable: 10,
  commerceNit: 111111111,
  ...overrides,
})

async function cleanTables() {
  await db.delete(products)
  await db.delete(commerce)
}

beforeEach(async () => {
  await cleanTables()
  await db.insert(commerce).values([
    baseCommerce({ nit: 111111111 }),
    baseCommerce({ nit: 222222222, legalName: 'Second Commerce', email: 'second@commerce.com' }),
  ])
})

afterAll(async () => {
  await cleanTables()
})

describe('productsRepository.findAll', () => {
  it('returns an empty array when there are no products', async () => {
    const result = await productsRepository.findAll()
    expect(result).toEqual([])
  })

  it('returns all products', async () => {
    await db.insert(products).values([
      baseProduct({ shortName: 'Shirt' }),
      baseProduct({ shortName: 'Pants', commerceNit: 222222222 }),
    ])

    const result = await productsRepository.findAll()

    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Pants', 'Shirt'])
  })
})

describe('productsRepository.findByCommerce', () => {
  it('returns only the products of the given commerce', async () => {
    await db.insert(products).values([
      baseProduct({ shortName: 'Shirt', commerceNit: 111111111 }),
      baseProduct({ shortName: 'Hat', commerceNit: 111111111 }),
      baseProduct({ shortName: 'Pants', commerceNit: 222222222 }),
    ])

    const result = await productsRepository.findByCommerce(111111111)

    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Hat', 'Shirt'])
  })

  it('returns an empty array when the commerce has no products', async () => {
    const result = await productsRepository.findByCommerce(222222222)
    expect(result).toEqual([])
  })
})

describe('productsRepository.findById', () => {
  it('returns the product when it exists', async () => {
    const [inserted] = await db.insert(products).values(baseProduct()).returning()

    const result = await productsRepository.findById(inserted.id)

    expect(result).toBeDefined()
    expect(result?.id).toBe(inserted.id)
    expect(result?.shortName).toBe('Shirt')
  })

  it('returns undefined when the product does not exist', async () => {
    const result = await productsRepository.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeUndefined()
  })
})

describe('productsRepository.search', () => {
  beforeEach(async () => {
    await db.insert(products).values([
      baseProduct({
        shortName: 'Blue Shirt',
        fullName: 'Blue Cotton Shirt',
        price: '50.00',
        amountAvailable: 5,
        commerceNit: 111111111,
      }),
      baseProduct({
        shortName: 'Red Shirt',
        fullName: 'Red Cotton Shirt',
        price: '80.00',
        amountAvailable: 20,
        commerceNit: 111111111,
      }),
      baseProduct({
        shortName: 'Blue Pants',
        fullName: 'Blue Denim Pants',
        price: '150.00',
        amountAvailable: 2,
        commerceNit: 222222222,
      }),
    ])
  })

  it('returns all products when no filters are provided', async () => {
    const result = await productsRepository.search({})
    expect(result).toHaveLength(3)
  })

  it('filters by partial, case-insensitive shortName', async () => {
    const result = await productsRepository.search({ shortName: 'blue' })
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Blue Pants', 'Blue Shirt'])
  })

  it('filters by partial fullName', async () => {
    const result = await productsRepository.search({ fullName: 'denim' })
    expect(result).toHaveLength(1)
    expect(result[0].shortName).toBe('Blue Pants')
  })

  it('filters by commerceNit', async () => {
    const result = await productsRepository.search({ commerceNit: 222222222 })
    expect(result).toHaveLength(1)
    expect(result[0].shortName).toBe('Blue Pants')
  })

  it('filters by minPrice', async () => {
    const result = await productsRepository.search({ minPrice: 80 })
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Blue Pants', 'Red Shirt'])
  })

  it('filters by maxPrice', async () => {
    const result = await productsRepository.search({ maxPrice: 80 })
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Blue Shirt', 'Red Shirt'])
  })

  it('filters by a price range (minPrice and maxPrice combined)', async () => {
    const result = await productsRepository.search({ minPrice: 60, maxPrice: 100 })
    expect(result).toHaveLength(1)
    expect(result[0].shortName).toBe('Red Shirt')
  })

  it('filters by minAmountAvailable', async () => {
    const result = await productsRepository.search({ minAmountAvailable: 5 })
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Blue Shirt', 'Red Shirt'])
  })

  it('filters by maxAmountAvailable', async () => {
    const result = await productsRepository.search({ maxAmountAvailable: 5 })
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.shortName).sort()).toEqual(['Blue Pants', 'Blue Shirt'])
  })

  it('combines multiple filters with AND semantics', async () => {
    const result = await productsRepository.search({
      shortName: 'shirt',
      commerceNit: 111111111,
      minPrice: 60,
    })
    expect(result).toHaveLength(1)
    expect(result[0].shortName).toBe('Red Shirt')
  })

  it('returns an empty array when no product matches the filters', async () => {
    const result = await productsRepository.search({ shortName: 'nonexistent' })
    expect(result).toEqual([])
  })
})

describe('productsRepository.create', () => {
  it('creates the product and returns it', async () => {
    const result = await productsRepository.create(baseProduct({ shortName: 'New Product' }))

    expect(result.shortName).toBe('New Product')
    expect(result.id).toBeDefined()

    const [inDb] = await db.select().from(products).where(eq(products.id, result.id))
    expect(inDb).toBeDefined()
  })
})

describe('productsRepository.update', () => {
  it('updates and returns the product when it exists', async () => {
    const [inserted] = await db.insert(products).values(baseProduct()).returning()

    const result = await productsRepository.update(inserted.id, { price: '200.00' })

    expect(result).toBeDefined()
    expect(result?.price).toBe('200.00')
    expect(result?.shortName).toBe('Shirt')
  })

  it('returns undefined when the product does not exist', async () => {
    const result = await productsRepository.update('00000000-0000-0000-0000-000000000000', {
      price: '999.00',
    })
    expect(result).toBeUndefined()
  })
})

describe('productsRepository.delete', () => {
  it('deletes the product and returns true when it exists', async () => {
    const [inserted] = await db.insert(products).values(baseProduct()).returning()

    const result = await productsRepository.delete(inserted.id)

    expect(result).toBe(true)
    const [remaining] = await db.select().from(products).where(eq(products.id, inserted.id))
    expect(remaining).toBeUndefined()
  })

  it('returns false when the product does not exist', async () => {
    const result = await productsRepository.delete('00000000-0000-0000-0000-000000000000')
    expect(result).toBe(false)
  })
})