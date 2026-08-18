
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { commerceController } from '../commerce.controller.ts'
import { commerceService } from '../commerce.service.ts'

vi.mock('../commerce.service.ts', () => ({
  commerceService: {
    getAll: vi.fn(),
    getByNit: vi.fn(),
    searchCommerce: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedCommerceService = vi.mocked(commerceService)

const fakeCommerce = {
  nit: '123456789',
  legalName: 'ACME Corp',
  shortName: 'ACME',
  address: 'Main St 123',
  contactNumber: '3000000000',
  email: 'contact@acme.com',
  createdAt: new Date(),
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

describe('commerceController.getAll', () => {
  it('responds with the list of commerces', async () => {
    mockedCommerceService.getAll.mockResolvedValue([fakeCommerce])
    const req = createMockReq()

    await commerceController.getAll(req, res, next)

    expect(mockedCommerceService.getAll).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith([fakeCommerce])
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('boom')
    mockedCommerceService.getAll.mockRejectedValue(error)
    const req = createMockReq()

    await commerceController.getAll(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('commerceController.getByNit', () => {
  it('responds with the commerce for a plain string nit', async () => {
    mockedCommerceService.getByNit.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: '123456789' } })

    await commerceController.getByNit(req, res, next)

    expect(mockedCommerceService.getByNit).toHaveBeenCalledWith('123456789')
    expect(res.json).toHaveBeenCalledWith(fakeCommerce)
  })

  it('uses the first element when nit arrives as an array', async () => {
    mockedCommerceService.getByNit.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: ['123456789', '987654321'] as any } })

    await commerceController.getByNit(req, res, next)

    expect(mockedCommerceService.getByNit).toHaveBeenCalledWith('123456789')
  })

  it('passes an empty string when nit is undefined', async () => {
    mockedCommerceService.getByNit.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: {} })

    await commerceController.getByNit(req, res, next)

    expect(mockedCommerceService.getByNit).toHaveBeenCalledWith('')
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedCommerceService.getByNit.mockRejectedValue(error)
    const req = createMockReq({ params: { nit: 'missing-nit' } })

    await commerceController.getByNit(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('commerceController.queryCommerce', () => {
  it('responds with the matching commerces using the provided body', async () => {
    mockedCommerceService.searchCommerce.mockResolvedValue([fakeCommerce])
    const req = createMockReq({ body: { legalName: 'ACME' } })

    await commerceController.queryCommerce(req, res, next)

    expect(mockedCommerceService.searchCommerce).toHaveBeenCalledWith({ legalName: 'ACME' })
    expect(res.json).toHaveBeenCalledWith([fakeCommerce])
  })

  it('defaults to an empty object when body is undefined', async () => {
    mockedCommerceService.searchCommerce.mockResolvedValue([])
    const req = createMockReq({ body: undefined })

    await commerceController.queryCommerce(req, res, next)

    expect(mockedCommerceService.searchCommerce).toHaveBeenCalledWith({})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('boom')
    mockedCommerceService.searchCommerce.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await commerceController.queryCommerce(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('commerceController.create', () => {
  it('responds 201 with the created commerce', async () => {
    mockedCommerceService.create.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ body: { nit: '123456789' } })

    await commerceController.create(req, res, next)

    expect(mockedCommerceService.create).toHaveBeenCalledWith({ nit: '123456789' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeCommerce)
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('conflict')
    mockedCommerceService.create.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await commerceController.create(req, res, next)

    // res.status(201) is evaluated synchronously before the `await` on
    // commerceService.create settles (it's evaluated first in the
    // `res.status(201).json(await ...)` chain), so it IS called even on
    // failure. What must NOT happen is res.json, since the rejection
    // short-circuits before `.json(...)` receives its argument.
    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('commerceController.replace', () => {
  it('responds with the replaced commerce for a plain string nit', async () => {
    mockedCommerceService.replace.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: '123456789' }, body: { legalName: 'ACME Corp' } })

    await commerceController.replace(req, res, next)

    expect(mockedCommerceService.replace).toHaveBeenCalledWith('123456789', { legalName: 'ACME Corp' })
    expect(res.json).toHaveBeenCalledWith(fakeCommerce)
  })

  it('uses the first element when nit arrives as an array', async () => {
    mockedCommerceService.replace.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: ['123456789', '987654321'] as any }, body: {} })

    await commerceController.replace(req, res, next)

    expect(mockedCommerceService.replace).toHaveBeenCalledWith('123456789', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedCommerceService.replace.mockRejectedValue(error)
    const req = createMockReq({ params: { nit: 'missing-nit' }, body: {} })

    await commerceController.replace(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('commerceController.patch', () => {
  it('responds with the patched commerce for a plain string nit', async () => {
    mockedCommerceService.patch.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: '123456789' }, body: { address: 'New Address' } })

    await commerceController.patch(req, res, next)

    expect(mockedCommerceService.patch).toHaveBeenCalledWith('123456789', { address: 'New Address' })
    expect(res.json).toHaveBeenCalledWith(fakeCommerce)
  })

  it('uses the first element when nit arrives as an array', async () => {
    mockedCommerceService.patch.mockResolvedValue(fakeCommerce)
    const req = createMockReq({ params: { nit: ['123456789', '987654321'] as any }, body: {} })

    await commerceController.patch(req, res, next)

    expect(mockedCommerceService.patch).toHaveBeenCalledWith('123456789', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('bad request')
    mockedCommerceService.patch.mockRejectedValue(error)
    const req = createMockReq({ params: { nit: '123456789' }, body: {} })

    await commerceController.patch(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('commerceController.delete', () => {
  it('responds 204 with no content for a plain string nit', async () => {
    mockedCommerceService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { nit: '123456789' } })

    await commerceController.delete(req, res, next)

    expect(mockedCommerceService.delete).toHaveBeenCalledWith('123456789')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalledTimes(1)
  })

  it('uses the first element when nit arrives as an array', async () => {
    mockedCommerceService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { nit: ['123456789', '987654321'] as any } })

    await commerceController.delete(req, res, next)

    expect(mockedCommerceService.delete).toHaveBeenCalledWith('123456789')
  })

  it('calls next with the error when the service throws, without responding', async () => {
    const error = new Error('not found')
    mockedCommerceService.delete.mockRejectedValue(error)
    const req = createMockReq({ params: { nit: 'missing-nit' } })

    await commerceController.delete(req, res, next)

    // Unlike `create`, here `await commerceService.delete(nit)` is its own
    // statement, separate from `res.status(204).send()`. So on rejection,
    // res.status is never reached at all.
    expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.send).not.toHaveBeenCalled()
  })
})