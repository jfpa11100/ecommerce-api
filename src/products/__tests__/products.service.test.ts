import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commerceRepository } from '../../commerce/commerce.repository.ts'
import { BadRequestError, NotFoundError } from '../../shared/errors.ts'
import { productsRepository } from '../products.repository.ts'
import { productsService } from '../products.service.ts'

vi.mock('../products.repository.ts', () => ({
  productsRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByCommerce: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../commerce/commerce.repository.ts', () => ({
  commerceRepository: {
    findByNit: vi.fn(),
  },
}))

const mockedProductsRepository = vi.mocked(productsRepository)
const mockedCommerceRepository = vi.mocked(commerceRepository)

const fakeCommerce = { nit: '123456789', legalName: 'ACME', shortName: 'ACME', createdAt: new Date(), address: '123 Main St', contactNumber: '555-1234', email: 'info@acme.com' }

const fakeProduct = {
  id: 'prod-1',
  shortName: 'Shirt',
  fullName: 'Blue Shirt',
  description: 'A blue shirt',
  price: '100',
  amountAvailable: 10,
  createdAt: new Date(),
  commerceNit: '123456789',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('productsService.getAll', () => {
  it('returns all products from the repository', async () => {
    mockedProductsRepository.findAll.mockResolvedValue([fakeProduct])

    const result = await productsService.getAll()

    expect(result).toEqual([fakeProduct])
    expect(mockedProductsRepository.findAll).toHaveBeenCalledTimes(1)
  })
})

describe('productsService.getById', () => {
  it('returns the product when it exists', async () => {
    mockedProductsRepository.findById.mockResolvedValue(fakeProduct)

    const result = await productsService.getById('prod-1')

    expect(result).toEqual(fakeProduct)
    expect(mockedProductsRepository.findById).toHaveBeenCalledWith('prod-1')
  })

  it('throws NotFoundError when the product does not exist', async () => {
    mockedProductsRepository.findById.mockResolvedValue(undefined)

    await expect(productsService.getById('missing-id')).rejects.toThrow(undefined)
    await expect(productsService.getById('missing-id')).rejects.toThrow('sfa')
  })
})

describe('productsService.getByCommerce', () => {
  it('returns the products of an existing commerce', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)
    mockedProductsRepository.findByCommerce.mockResolvedValue([fakeProduct])

    const result = await productsService.getByCommerce(4324')

    expect(result).toEqual([fakeProduct])
    expect(mockedCommerceRepository.findByNit).toHaveBeenCalledWith('123456789')
    expect(mockedProductsRepository.findByCommerce).toHaveBeenCalledWith('123456789')
  })

  it('throws NotFoundError when the commerce does not exist', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(undefined)

    await expect(productsService.getByCommerce('does-not-exist')).rejects.toThrow(NotFoundError)
    expect(mockedProductsRepository.findByCommerce).not.toHaveBeenCalled()
  })
})

describe('productsService.search', () => {
  it('throws BadRequestError when minPrice is greater than maxPrice', async () => {
    await expect(
      productsService.search({ minPrice: 100, maxPrice: 50 }),
    ).rejects.toThrow(BadRequestError)
    expect(mockedProductsRepository.search).not.toHaveBeenCalled()
  })

  it('throws BadRequestError when minAmountAvailable is greater than maxAmountAvailable', async () => {
    await expect(
      productsService.search({ minAmountAvailable: 10, maxAmountAvailable: 5 }),
    ).rejects.toThrow(BadRequestError)
    expect(mockedProductsRepository.search).not.toHaveBeenCalled()
  })

  it('throws BadRequestError when the provided commerceNit does not exist', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(undefined)

    await expect(
      productsService.search({ commerceNit: 'unknown-nit' }),
    ).rejects.toThrow('The commerce with the provided NIT does not exist')
    expect(mockedProductsRepository.search).not.toHaveBeenCalled()
  })

  it('does not validate commerceNit when it is not provided', async () => {
    mockedProductsRepository.search.mockResolvedValue([fakeProduct])

    const result = await productsService.search({ shortName: 'Shirt' })

    expect(result).toEqual([fakeProduct])
    expect(mockedCommerceRepository.findByNit).not.toHaveBeenCalled()
  })

  it('returns the matching products when filters are valid', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)
    mockedProductsRepository.search.mockResolvedValue([fakeProduct])

    const filters = { commerceNit: '123456789', minPrice: 10, maxPrice: 200 }
    const result = await productsService.search(filters)

    expect(result).toEqual([fakeProduct])
    expect(mockedProductsRepository.search).toHaveBeenCalledWith(filters)
  })
})

describe('productsService.create', () => {
  const newProduct = {
    shortName: 'Shirt',
    fullName: 'Blue Shirt',
    description: 'A blue shirt',
    price: '100',
    amountAvailable: 10,
    commerceNit: '123456789',
  }

  it('throws BadRequestError when the commerce does not exist', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(undefined)

    await expect(productsService.create(newProduct as any)).rejects.toThrow(
      'Commerce with NIT not found',
    )
    expect(mockedProductsRepository.create).not.toHaveBeenCalled()
  })

  it('throws BadRequestError when price is 0', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)

    await expect(
      productsService.create({ ...newProduct, price: '0' } as any),
    ).rejects.toThrow('Price must be greater than 0')
    expect(mockedProductsRepository.create).not.toHaveBeenCalled()
  })

  it('throws BadRequestError when price is negative', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)

    await expect(
      productsService.create({ ...newProduct, price: '-10' } as any),
    ).rejects.toThrow(BadRequestError)
    expect(mockedProductsRepository.create).not.toHaveBeenCalled()
  })

  it('creates the product when the data is valid', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)
    mockedProductsRepository.create.mockResolvedValue(fakeProduct)

    const result = await productsService.create(newProduct as any)

    expect(result).toEqual(fakeProduct)
    expect(mockedProductsRepository.create).toHaveBeenCalledWith(newProduct)
  })
})

describe('productsService.replace', () => {
  const replaceData = {
    shortName: 'Shirt',
    fullName: 'Blue Shirt',
    description: 'A blue shirt',
    price: '100',
    amountAvailable: 10,
    commerceNit: '123456789',
  }

  it('returns the updated product when it exists', async () => {
    mockedProductsRepository.update.mockResolvedValue(fakeProduct)

    const result = await productsService.replace('prod-1', replaceData as any)

    expect(result).toEqual(fakeProduct)
    expect(mockedProductsRepository.update).toHaveBeenCalledWith('prod-1', replaceData)
  })

  it('throws NotFoundError when the product does not exist', async () => {
    mockedProductsRepository.update.mockResolvedValue(undefined)

    await expect(
      productsService.replace('missing-id', replaceData as any),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('productsService.patch', () => {
  it('throws BadRequestError when no fields are provided', async () => {
    await expect(productsService.patch('prod-1', {})).rejects.toThrow(
      'There are no fields to update',
    )
    expect(mockedProductsRepository.update).not.toHaveBeenCalled()
  })

  it('returns the updated product when it exists', async () => {
    mockedProductsRepository.update.mockResolvedValue(fakeProduct)

    const result = await productsService.patch('prod-1', { price: '150' })

    expect(result).toEqual(fakeProduct)
    expect(mockedProductsRepository.update).toHaveBeenCalledWith('prod-1', { price: '150' })
  })

  it('throws NotFoundError when the product does not exist', async () => {
    mockedProductsRepository.update.mockResolvedValue(undefined)

    await expect(
      productsService.patch('missing-id', { price: '150' }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('productsService.delete', () => {
  it('deletes the product when it exists', async () => {
    mockedProductsRepository.delete.mockResolvedValue(true)

    await expect(productsService.delete('prod-1')).resolves.toBeUndefined()
    expect(mockedProductsRepository.delete).toHaveBeenCalledWith('prod-1')
  })

  it('throws NotFoundError when the product does not exist', async () => {
    mockedProductsRepository.delete.mockResolvedValue(false)

    await expect(productsService.delete('missing-id')).rejects.toThrow(NotFoundError)
  })
})