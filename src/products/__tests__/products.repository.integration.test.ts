import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/connection.ts'
import { commerce } from '../../db/schemas/commerce.schema.ts'
import { products } from '../../db/schemas/product.schema.ts'
import { productsRepository } from '../products.repository.ts'
import { eq } from 'drizzle-orm'

describe('Products Repository Integration Tests', () => {
  beforeEach(async () => {
    await db.delete(products)
    await db.delete(commerce)
  })

  async function createCommerce(nit = 100000001) {
    return db.insert(commerce).values({
      nit,
      legalName: `Commerce ${nit}`,
      shortName: `Commerce ${nit}`,
      address: `${nit} Main Street`,
      contactNumber: `300${nit}`,
      email: `commerce${nit}@example.com`,
    }).returning()
  }

  describe('findAll', () => {
    it('should return all products', async () => {


      await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      await productsRepository.create({
        shortName: 'Mouse',
        fullName: 'Wireless Mouse',
        description: 'Wireless ergonomic mouse',
        price: '50.00',
        amountAvailable: 25,
        commerceNit: 100000001,
      })

      const result = await productsRepository.findAll()

      expect(result).toHaveLength(2)

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            shortName: 'Laptop',
            fullName: 'Professional Laptop',
            price: '2500',
            amountAvailable: 10,
            commerceNit: 100000001,
          }),
          expect.objectContaining({
            shortName: 'Mouse',
            fullName: 'Wireless Mouse',
            price: '50',
            amountAvailable: 25,
            commerceNit: 100000001,
          }),
        ]),
      )
    })

    it('should return an empty array when there are no products', async () => {
      const result = await productsRepository.findAll()

      expect(result).toEqual([])
    })
  })

  describe('findByCommerce', () => {
    it('should return all products belonging to a commerce', async () => {
      await createCommerce(100000001)
      await createCommerce(100000002)

      await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      await productsRepository.create({
        shortName: 'Mouse',
        fullName: 'Wireless Mouse',
        description: 'Wireless ergonomic mouse',
        price: '50.00',
        amountAvailable: 25,
        commerceNit: 100000001,
      })

      await productsRepository.create({
        shortName: 'Keyboard',
        fullName: 'Mechanical Keyboard',
        description: 'Mechanical RGB keyboard',
        price: '120.00',
        amountAvailable: 15,
        commerceNit: 100000002,
      })

      const result = await productsRepository.findByCommerce(100000001)

      expect(result).toHaveLength(2)

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            shortName: 'Laptop',
            commerceNit: 100000001,
            price: '2500'
          }),
          expect.objectContaining({
            shortName: 'Mouse',
            commerceNit: 100000001,
            price: '50'
          }),
        ]),
      )
    })

    it('should return an empty array when the commerce has no products', async () => {
      await createCommerce(100000001)

      const result = await productsRepository.findByCommerce(100000001)

      expect(result).toEqual([])
    })

    it('should return an empty array when the commerce does not exist', async () => {
      const result = await productsRepository.findByCommerce(999999999)

      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('should return a product when the id exists', async () => {
      await createCommerce()

      const created = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      const result = await productsRepository.findById(created.id)

      expect(result).toEqual(
        expect.objectContaining({
          id: created.id,
          shortName: 'Laptop',
          fullName: 'Professional Laptop',
          description: 'High performance laptop',
          price: '2500',
          amountAvailable: 10,
          commerceNit: 100000001,
        }),
      )

      expect(result?.createdAt).toBeInstanceOf(Date)
    })

    it('should return undefined when the id does not exist', async () => {
      const result = await productsRepository.findById(
        '00000000-0000-0000-0000-000000000000',
      )

      expect(result).toBeUndefined()
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await createCommerce(100000001)
      await createCommerce(100000002)

      await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      await productsRepository.create({
        shortName: 'Mouse',
        fullName: 'Wireless Mouse',
        description: 'Wireless ergonomic mouse',
        price: '50.00',
        amountAvailable: 25,
        commerceNit: 100000001,
      })

      await productsRepository.create({
        shortName: 'Keyboard',
        fullName: 'Mechanical Keyboard',
        description: 'Mechanical RGB keyboard',
        price: '120.00',
        amountAvailable: 15,
        commerceNit: 100000002,
      })

      await productsRepository.create({
        shortName: 'Monitor',
        fullName: 'Ultra Wide Monitor',
        description: '34-inch ultra wide monitor',
        price: '900.00',
        amountAvailable: 5,
        commerceNit: 100000002,
      })
    })

    it('should return all products when no filters are provided', async () => {
      const result = await productsRepository.search({})

      expect(result).toHaveLength(4)
    })

    it('should search by short name', async () => {
      const result = await productsRepository.search({
        shortName: 'LAPTOP',
      })

      expect(result).toHaveLength(1)

      expect(result[0]).toEqual(
        expect.objectContaining({
          shortName: 'Laptop',
          fullName: 'Professional Laptop',
        }),
      )
    })

    it('should search by full name', async () => {
      const result = await productsRepository.search({
        fullName: 'wireless',
      })

      expect(result).toHaveLength(1)

      expect(result[0]).toEqual(
        expect.objectContaining({
          shortName: 'Mouse',
          fullName: 'Wireless Mouse',
        }),
      )
    })

    it('should filter by commerce NIT', async () => {
      const result = await productsRepository.search({
        commerceNit: 100000001,
      })

      expect(result).toHaveLength(2)

      expect(result.every((product) => product.commerceNit === 100000001))
        .toBe(true)
    })

    it('should filter by minimum price', async () => {
      const result = await productsRepository.search({
        minPrice: 900,
      })

      expect(result).toHaveLength(2)

      expect(result.map((product) => product.shortName)).toEqual(
        expect.arrayContaining(['Laptop', 'Monitor']),
      )
    })

    it('should filter by maximum price', async () => {
      const result = await productsRepository.search({
        maxPrice: 120,
      })

      expect(result).toHaveLength(2)

      expect(result.map((product) => product.shortName)).toEqual(
        expect.arrayContaining(['Mouse', 'Keyboard']),
      )
    })

    it('should filter by minimum available amount', async () => {
      const result = await productsRepository.search({
        minAmountAvailable: 15,
      })

      expect(result).toHaveLength(2)

      expect(result.map((product) => product.shortName)).toEqual(
        expect.arrayContaining(['Mouse', 'Keyboard']),
      )
    })

    it('should filter by maximum available amount', async () => {
      const result = await productsRepository.search({
        maxAmountAvailable: 10,
      })

      expect(result).toHaveLength(2)

      expect(result.map((product) => product.shortName)).toEqual(
        expect.arrayContaining(['Laptop', 'Monitor']),
      )
    })

    it('should apply multiple filters at the same time', async () => {
      const result = await productsRepository.search({
        commerceNit: 100000001,
        minPrice: 100,
        maxPrice: 3000,
        minAmountAvailable: 5,
        maxAmountAvailable: 15,
      })

      expect(result).toHaveLength(1)

      expect(result[0]).toEqual(
        expect.objectContaining({
          shortName: 'Laptop',
          commerceNit: 100000001,
          price: '2500',
          amountAvailable: 10,
        }),
      )
    })

    it('should return an empty array when no product matches the filters', async () => {
      const result = await productsRepository.search({
        shortName: 'Non Existing Product',
      })

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create and return a product', async () => {
      await createCommerce()

      const data = {
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      }

      const result = await productsRepository.create(data)

      expect(result).toEqual(
        expect.objectContaining({...data, price: '2500'}),
      )

      expect(result.id).toEqual(expect.any(String))
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should generate an id automatically', async () => {
      await createCommerce()

      const result = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        commerceNit: 100000001,
      })

      expect(result.id).toEqual(expect.any(String))
    })

    it('should use zero as the default available amount', async () => {
      await createCommerce()

      const result = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        commerceNit: 100000001,
      })

      expect(result.amountAvailable).toBe(0)
    })

    it('should fail when creating a product for a non-existing commerce', async () => {
      await expect(
        productsRepository.create({
          shortName: 'Laptop',
          fullName: 'Professional Laptop',
          description: 'High performance laptop',
          price: '2500.00',
          amountAvailable: 10,
          commerceNit: 999999999,
        }),
      ).rejects.toThrow()
    })
  })

  describe('update', () => {
    let productId: string

    beforeEach(async () => {
      await createCommerce()

      const product = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      productId = product.id
    })

    it('should update a product and return the updated record', async () => {
      const result = await productsRepository.update(productId, {
        shortName: 'Updated Laptop',
        price: '2750.00',
        amountAvailable: 20,
      })

      expect(result).toEqual(
        expect.objectContaining({
          id: productId,
          shortName: 'Updated Laptop',
          price: '2750',
          amountAvailable: 20,
          fullName: 'Professional Laptop',
          commerceNit: 100000001,
        }),
      )
    })

    it('should update only the provided fields', async () => {
      await productsRepository.update(productId, {
        amountAvailable: 50,
      })

      const result = await productsRepository.findById(productId)

      expect(result).toEqual(
        expect.objectContaining({
          id: productId,
          shortName: 'Laptop',
          fullName: 'Professional Laptop',
          description: 'High performance laptop',
          price: '2500',
          amountAvailable: 50,
          commerceNit: 100000001,
        }),
      )
    })

    it('should return undefined when updating a non-existing product', async () => {
      const result = await productsRepository.update(
        '00000000-0000-0000-0000-000000000000',
        {
          shortName: 'Updated',
        },
      )

      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('should delete an existing product and return true', async () => {
      await createCommerce()

      const product = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      const result = await productsRepository.delete(product.id)

      expect(result).toBe(true)

      const deletedProduct = await productsRepository.findById(product.id)

      expect(deletedProduct).toBeUndefined()
    })

    it('should return false when deleting a non-existing product', async () => {
      const result = await productsRepository.delete(
        '00000000-0000-0000-0000-000000000000',
      )

      expect(result).toBe(false)
    })
  })

  describe('commerce relationship', () => {
    it('should delete products when their commerce is deleted', async () => {
      await createCommerce(100000001)

      const product = await productsRepository.create({
        shortName: 'Laptop',
        fullName: 'Professional Laptop',
        description: 'High performance laptop',
        price: '2500.00',
        amountAvailable: 10,
        commerceNit: 100000001,
      })

      await db
        .delete(commerce)
        .where(eq(commerce.nit, 100000001))

      const result = await productsRepository.findById(product.id)

      expect(result).toBeUndefined()
    })
  })
})