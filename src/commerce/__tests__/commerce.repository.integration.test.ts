import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/connection.ts'
import { commerce } from '../../db/schemas/commerce.schema.ts'
import { commerceRepository } from '../commerce.repository.ts'

describe('Commerce Repository Integration Tests', () => {
  beforeEach(async () => {
    await db.delete(commerce)
  })

  describe('findAll', () => {
    it('should return all commerces', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      await commerceRepository.create({
        nit: 100000002,
        legalName: 'Tech Solutions S.A.S.',
        shortName: 'Tech Solutions',
        address: '456 Technology Avenue',
        contactNumber: '3000000002',
        email: 'tech@example.com',
      })

      const result = await commerceRepository.findAll()

      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nit: 100000001,
            legalName: 'Acme Corporation S.A.S.',
            shortName: 'Acme',
          }),
          expect.objectContaining({
            nit: 100000002,
            legalName: 'Tech Solutions S.A.S.',
            shortName: 'Tech Solutions',
          }),
        ]),
      )
    })

    it('should return an empty array when there are no commerces', async () => {
      const result = await commerceRepository.findAll()

      expect(result).toEqual([])
    })
  })

  describe('findByNit', () => {
    it('should return a commerce when the NIT exists', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      const result = await commerceRepository.findByNit(100000001)

      expect(result).toEqual(
        expect.objectContaining({
          nit: 100000001,
          legalName: 'Acme Corporation S.A.S.',
          shortName: 'Acme',
          address: '123 Main Street',
          contactNumber: '3000000001',
          email: 'acme@example.com',
        }),
      )

      expect(result?.createdAt).toBeInstanceOf(Date)
    })

    it('should return undefined when the NIT does not exist', async () => {
      const result = await commerceRepository.findByNit(999999999)

      expect(result).toBeUndefined()
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
        createdAt: new Date('2026-01-10T10:00:00.000Z'),
      })

      await commerceRepository.create({
        nit: 100000002,
        legalName: 'Technology Solutions S.A.S.',
        shortName: 'Tech Solutions',
        address: '456 Technology Avenue',
        contactNumber: '3000000002',
        email: 'tech@example.com',
        createdAt: new Date('2026-02-15T10:00:00.000Z'),
      })

      await commerceRepository.create({
        nit: 100000003,
        legalName: 'Global Commerce S.A.S.',
        shortName: 'Global',
        address: '789 Business Road',
        contactNumber: '3000000003',
        email: 'global@example.com',
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
      })
    })

    it('should return all commerces when no filters are provided', async () => {
      const result = await commerceRepository.search({})

      expect(result).toHaveLength(3)
    })

    it('should search by legal name', async () => {
      const result = await commerceRepository.search({
        legalName: 'technology',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          nit: 100000002,
          legalName: 'Technology Solutions S.A.S.',
        }),
      )
    })

    it('should search by short name', async () => {
      const result = await commerceRepository.search({
        shortName: 'ACME',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          nit: 100000001,
          shortName: 'Acme',
        }),
      )
    })

    it('should search by email', async () => {
      const result = await commerceRepository.search({
        email: 'TECH@EXAMPLE.COM',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          nit: 100000002,
          email: 'tech@example.com',
        }),
      )
    })

    it('should search by address', async () => {
      const result = await commerceRepository.search({
        address: 'business',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          nit: 100000003,
          address: '789 Business Road',
        }),
      )
    })

    it('should filter commerces created from a specific date', async () => {
      const result = await commerceRepository.search({
        createdFrom: '2026-02-15T10:00:00.000Z',
      })

      expect(result).toHaveLength(2)

      expect(result.map((commerce) => commerce.nit)).toEqual(
        expect.arrayContaining([100000002, 100000003]),
      )
    })

    it('should filter commerces created until a specific date', async () => {
      const result = await commerceRepository.search({
        createdTo: '2026-02-15T10:00:00.000Z',
      })

      expect(result).toHaveLength(2)

      expect(result.map((commerce) => commerce.nit)).toEqual(
        expect.arrayContaining([100000001, 100000002]),
      )
    })

    it('should apply multiple filters at the same time', async () => {
      const result = await commerceRepository.search({
        legalName: 'Corporation',
        shortName: 'Acme',
        address: 'Main',
        email: 'acme',
        createdFrom: '2026-01-01T00:00:00.000Z',
        createdTo: '2026-01-31T23:59:59.999Z',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          nit: 100000001,
          legalName: 'Acme Corporation S.A.S.',
          shortName: 'Acme',
        }),
      )
    })

    it('should return an empty array when no commerce matches the filters', async () => {
      const result = await commerceRepository.search({
        legalName: 'Non Existing Commerce',
      })

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create and return a commerce', async () => {
      const data = {
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      }

      const result = await commerceRepository.create(data)

      expect(result).toEqual(
        expect.objectContaining(data),
      )

      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should persist the commerce in the database', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      const result = await commerceRepository.findByNit(100000001)

      expect(result).toEqual(
        expect.objectContaining({
          nit: 100000001,
          legalName: 'Acme Corporation S.A.S.',
          shortName: 'Acme',
        }),
      )
    })

    it('should fail when creating a commerce with a duplicated NIT', async () => {
      const data = {
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      }

      await commerceRepository.create(data)

      await expect(
        commerceRepository.create({
          ...data,
          legalName: 'Another Corporation S.A.S.',
          shortName: 'Another',
          contactNumber: '3000000002',
          email: 'another@example.com',
        }),
      ).rejects.toThrow()
    })

    it('should fail when creating a commerce with a duplicated contact number', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      await expect(
        commerceRepository.create({
          nit: 100000002,
          legalName: 'Another Corporation S.A.S.',
          shortName: 'Another',
          address: '456 Another Street',
          contactNumber: '3000000001',
          email: 'another@example.com',
        }),
      ).rejects.toThrow()
    })

    it('should fail when creating a commerce with a duplicated email', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      await expect(
        commerceRepository.create({
          nit: 100000002,
          legalName: 'Another Corporation S.A.S.',
          shortName: 'Another',
          address: '456 Another Street',
          contactNumber: '3000000002',
          email: 'acme@example.com',
        }),
      ).rejects.toThrow()
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })
    })

    it('should update a commerce and return the updated record', async () => {
      const result = await commerceRepository.update(100000001, {
        legalName: 'Acme Updated Corporation S.A.S.',
        shortName: 'Acme Updated',
        address: '999 New Street',
      })

      expect(result).toEqual(
        expect.objectContaining({
          nit: 100000001,
          legalName: 'Acme Updated Corporation S.A.S.',
          shortName: 'Acme Updated',
          address: '999 New Street',
          contactNumber: '3000000001',
          email: 'acme@example.com',
        }),
      )
    })

    it('should update only the provided fields', async () => {
      await commerceRepository.update(100000001, {
        shortName: 'Updated Acme',
      })

      const result = await commerceRepository.findByNit(100000001)

      expect(result).toEqual(
        expect.objectContaining({
          nit: 100000001,
          legalName: 'Acme Corporation S.A.S.',
          shortName: 'Updated Acme',
          address: '123 Main Street',
          contactNumber: '3000000001',
          email: 'acme@example.com',
        }),
      )
    })

    it('should return undefined when updating a non-existing commerce', async () => {
      const result = await commerceRepository.update(999999999, {
        shortName: 'Updated',
      })

      expect(result).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('should delete an existing commerce and return true', async () => {
      await commerceRepository.create({
        nit: 100000001,
        legalName: 'Acme Corporation S.A.S.',
        shortName: 'Acme',
        address: '123 Main Street',
        contactNumber: '3000000001',
        email: 'acme@example.com',
      })

      const result = await commerceRepository.delete(100000001)

      expect(result).toBe(true)

      const deletedCommerce = await commerceRepository.findByNit(100000001)

      expect(deletedCommerce).toBeUndefined()
    })

    it('should return false when deleting a non-existing commerce', async () => {
      const result = await commerceRepository.delete(999999999)

      expect(result).toBe(false)
    })
  })
})