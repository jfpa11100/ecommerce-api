import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { productsController } from '../products.controller.ts'
import { productsService } from '../products.service.ts'

vi.mock('../products.service.ts', () => ({
  productsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getByCommerce: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedProductsService = vi.mocked(productsService)

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

function createMockRes() {
  const res = {} as Response
  res.json = vi.fn().mockReturnValue(res)
  res.status = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res
}

function createMockReq(overrides: Partial<Request> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request
}

let res: Response
let next: NextFunction

beforeEach(() => {
  vi.clearAllMocks()
  res = createMockRes()
  next = vi.fn()
})

describe('productsController.getAll', () => {
  it('responds with all products when no commerceNit query is provided', async () => {
    mockedProductsService.getAll.mockResolvedValue([fakeProduct])
    const req = createMockReq({ query: {} })

    await productsController.getAll(req, res, next)

    expect(mockedProductsService.getAll).toHaveBeenCalledTimes(1)
    expect(mockedProductsService.getByCommerce).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith([fakeProduct])
  })

  it('responds with the products of a commerce when commerceNit query is a string', async () => {
    mockedProductsService.getByCommerce.mockResolvedValue([fakeProduct])
    const req = createMockReq({ query: { commerceNit: '123456789' } })

    await productsController.getAll(req, res, next)

    expect(mockedProductsService.getByCommerce).toHaveBeenCalledWith('123456789')
    expect(mockedProductsService.getAll).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith([fakeProduct])
    expect(res.json).toHaveBeenCalledTimes(1)
  })

  it('falls back to getAll when commerceNit query is not a string (e.g. array)', async () => {
    mockedProductsService.getAll.mockResolvedValue([fakeProduct])
    const req = createMockReq({ query: { commerceNit: ['123', '456'] as any } })

    await productsController.getAll(req, res, next)

    expect(mockedProductsService.getByCommerce).not.toHaveBeenCalled()
    expect(mockedProductsService.getAll).toHaveBeenCalledTimes(1)
  })

  it('calls next with the error when getAll throws', async () => {
    const error = new Error('boom')
    mockedProductsService.getAll.mockRejectedValue(error)
    const req = createMockReq({ query: {} })

    await productsController.getAll(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })

  it('calls next with the error when getByCommerce throws', async () => {
    const error = new Error('commerce not found')
    mockedProductsService.getByCommerce.mockRejectedValue(error)
    const req = createMockReq({ query: { commerceNit: '123456789' } })

    await productsController.getAll(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('productsController.getById', () => {
  it('responds with the product for a plain string id', async () => {
    mockedProductsService.getById.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: 'prod-1' } })

    await productsController.getById(req, res, next)

    expect(mockedProductsService.getById).toHaveBeenCalledWith('prod-1')
    expect(res.json).toHaveBeenCalledWith(fakeProduct)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedProductsService.getById.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: ['prod-1', 'prod-2'] as any } })

    await productsController.getById(req, res, next)

    expect(mockedProductsService.getById).toHaveBeenCalledWith('prod-1')
  })

  it('passes an empty string when id is undefined', async () => {
    mockedProductsService.getById.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: {} })

    await productsController.getById(req, res, next)

    expect(mockedProductsService.getById).toHaveBeenCalledWith('')
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedProductsService.getById.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' } })

    await productsController.getById(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('productsController.search', () => {
  it('responds with the matching products using the provided body', async () => {
    mockedProductsService.search.mockResolvedValue([fakeProduct])
    const req = createMockReq({ body: { shortName: 'Shirt' } })

    await productsController.search(req, res, next)

    expect(mockedProductsService.search).toHaveBeenCalledWith({ shortName: 'Shirt' })
    expect(res.json).toHaveBeenCalledWith([fakeProduct])
  })

  it('defaults to an empty object when body is undefined', async () => {
    mockedProductsService.search.mockResolvedValue([])
    const req = createMockReq({ body: undefined })

    await productsController.search(req, res, next)

    expect(mockedProductsService.search).toHaveBeenCalledWith({})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('minPrice > maxPrice')
    mockedProductsService.search.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await productsController.search(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('productsController.create', () => {
  it('responds 201 with the created product', async () => {
    mockedProductsService.create.mockResolvedValue(fakeProduct)
    const req = createMockReq({ body: { shortName: 'Shirt' } })

    await productsController.create(req, res, next)

    expect(mockedProductsService.create).toHaveBeenCalledWith({ shortName: 'Shirt' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeProduct)
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('commerce not found')
    mockedProductsService.create.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await productsController.create(req, res, next)

    // res.status(201) is evaluated synchronously before the `await` on
    // productsService.create settles (it's evaluated first in the
    // `res.status(201).json(await ...)` chain), so it IS called even on
    // failure. What must NOT happen is res.json, since the rejection
    // short-circuits before `.json(...)` receives its argument.
    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('productsController.replace', () => {
  it('responds with the replaced product for a plain string id', async () => {
    mockedProductsService.replace.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: 'prod-1' }, body: { shortName: 'Shirt' } })

    await productsController.replace(req, res, next)

    expect(mockedProductsService.replace).toHaveBeenCalledWith('prod-1', { shortName: 'Shirt' })
    expect(res.json).toHaveBeenCalledWith(fakeProduct)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedProductsService.replace.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: ['prod-1', 'prod-2'] as any }, body: {} })

    await productsController.replace(req, res, next)

    expect(mockedProductsService.replace).toHaveBeenCalledWith('prod-1', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedProductsService.replace.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' }, body: {} })

    await productsController.replace(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('productsController.patch', () => {
  it('responds with the patched product for a plain string id', async () => {
    mockedProductsService.patch.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: 'prod-1' }, body: { price: '150' } })

    await productsController.patch(req, res, next)

    expect(mockedProductsService.patch).toHaveBeenCalledWith('prod-1', { price: '150' })
    expect(res.json).toHaveBeenCalledWith(fakeProduct)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedProductsService.patch.mockResolvedValue(fakeProduct)
    const req = createMockReq({ params: { id: ['prod-1', 'prod-2'] as any }, body: {} })

    await productsController.patch(req, res, next)

    expect(mockedProductsService.patch).toHaveBeenCalledWith('prod-1', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('bad request')
    mockedProductsService.patch.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'prod-1' }, body: {} })

    await productsController.patch(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('productsController.delete', () => {
  it('responds 204 with no content for a plain string id', async () => {
    mockedProductsService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { id: 'prod-1' } })

    await productsController.delete(req, res, next)

    expect(mockedProductsService.delete).toHaveBeenCalledWith('prod-1')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalledTimes(1)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedProductsService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { id: ['prod-1', 'prod-2'] as any } })

    await productsController.delete(req, res, next)

    expect(mockedProductsService.delete).toHaveBeenCalledWith('prod-1')
  })

  it('calls next with the error when the service throws, without responding', async () => {
    const error = new Error('not found')
    mockedProductsService.delete.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' } })

    await productsController.delete(req, res, next)

    // `await productsService.delete(id)` is its own statement, separate from
    // `res.status(204).send()`. So on rejection, res.status is never reached.
    expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.send).not.toHaveBeenCalled()
  })
})