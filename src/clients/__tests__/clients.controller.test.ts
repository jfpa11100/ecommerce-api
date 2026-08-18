import type { Request, Response, NextFunction } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientsService } from "../clients.service.ts";
import { clientsController } from "../clients.controller.ts";

vi.mock("../clients.service.ts", () => ({
  clientsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    searchClient: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedClientsService = vi.mocked(clientsService)

const fakeClient = {
  id: 'client-1',
  createdAt: new Date(),
  name: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'hashed-password',
  shipAddress: '123 Main St',
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

describe('clientsController.getClients', () => {
  it('responds with the list of clients', async () => {
    mockedClientsService.getAll.mockResolvedValue([fakeClient])
    const req = createMockReq()

    await clientsController.getClients(req, res, next)

    expect(mockedClientsService.getAll).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith([fakeClient])
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('boom')
    mockedClientsService.getAll.mockRejectedValue(error)
    const req = createMockReq()

    await clientsController.getClients(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('clientsController.getById', () => {
  it('responds with the client for a plain string id', async () => {
    mockedClientsService.getById.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: 'client-1' } })

    await clientsController.getById(req, res, next)

    expect(mockedClientsService.getById).toHaveBeenCalledWith('client-1')
    expect(res.json).toHaveBeenCalledWith(fakeClient)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedClientsService.getById.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: ['client-1', 'client-2'] as any } })

    await clientsController.getById(req, res, next)

    expect(mockedClientsService.getById).toHaveBeenCalledWith('client-1')
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedClientsService.getById.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' } })

    await clientsController.getById(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('clientsController.queryClients', () => {
  it('responds with the matching clients using the provided body', async () => {
    mockedClientsService.searchClient.mockResolvedValue([fakeClient])
    const req = createMockReq({ body: { name: 'John' } })

    await clientsController.queryClients(req, res, next)

    expect(mockedClientsService.searchClient).toHaveBeenCalledWith({ name: 'John' })
    expect(res.json).toHaveBeenCalledWith([fakeClient])
  })

  it('defaults to an empty object when body is undefined', async () => {
    mockedClientsService.searchClient.mockResolvedValue([])
    const req = createMockReq({ body: undefined })

    await clientsController.queryClients(req, res, next)

    expect(mockedClientsService.searchClient).toHaveBeenCalledWith({})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('boom')
    mockedClientsService.searchClient.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await clientsController.queryClients(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('clientsController.create', () => {
  it('responds 201 with the created client', async () => {
    mockedClientsService.create.mockResolvedValue(fakeClient)
    const req = createMockReq({ body: { email: 'john@example.com' } })

    await clientsController.create(req, res, next)

    expect(mockedClientsService.create).toHaveBeenCalledWith({ email: 'john@example.com' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(fakeClient)
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('conflict')
    mockedClientsService.create.mockRejectedValue(error)
    const req = createMockReq({ body: {} })

    await clientsController.create(req, res, next)

    // res.status(201) already runs synchronously before the `await` on
    // clientsService.create settles (it's evaluated first in
    // `res.status(201).json(await ...)`), so it's expected to have been
    // called even on failure. What must NOT happen is res.json, since the
    // rejection short-circuits before `.json(...)` receives its argument.
    expect(next).toHaveBeenCalledWith(error)
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('clientsController.replace', () => {
  it('responds with the replaced client for a plain string id', async () => {
    mockedClientsService.replace.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: 'client-1' }, body: { name: 'John' } })

    await clientsController.replace(req, res, next)

    expect(mockedClientsService.replace).toHaveBeenCalledWith('client-1', { name: 'John' })
    expect(res.json).toHaveBeenCalledWith(fakeClient)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedClientsService.replace.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: ['client-1', 'client-2'] as any }, body: {} })

    await clientsController.replace(req, res, next)

    expect(mockedClientsService.replace).toHaveBeenCalledWith('client-1', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedClientsService.replace.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' }, body: {} })

    await clientsController.replace(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('clientsController.patch', () => {
  it('responds with the patched client for a plain string id', async () => {
    mockedClientsService.patch.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: 'client-1' }, body: { name: 'Jane' } })

    await clientsController.patch(req, res, next)

    expect(mockedClientsService.patch).toHaveBeenCalledWith('client-1', { name: 'Jane' })
    expect(res.json).toHaveBeenCalledWith(fakeClient)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedClientsService.patch.mockResolvedValue(fakeClient)
    const req = createMockReq({ params: { id: ['client-1', 'client-2'] as any }, body: {} })

    await clientsController.patch(req, res, next)

    expect(mockedClientsService.patch).toHaveBeenCalledWith('client-1', {})
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('bad request')
    mockedClientsService.patch.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'client-1' }, body: {} })

    await clientsController.patch(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('clientsController.delete', () => {
  it('responds 204 with no content for a plain string id', async () => {
    mockedClientsService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { id: 'client-1' } })

    await clientsController.delete(req, res, next)

    expect(mockedClientsService.delete).toHaveBeenCalledWith('client-1')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalledTimes(1)
  })

  it('uses the first element when id arrives as an array', async () => {
    mockedClientsService.delete.mockResolvedValue(undefined)
    const req = createMockReq({ params: { id: ['client-1', 'client-2'] as any } })

    await clientsController.delete(req, res, next)

    expect(mockedClientsService.delete).toHaveBeenCalledWith('client-1')
  })

  it('calls next with the error when the service throws', async () => {
    const error = new Error('not found')
    mockedClientsService.delete.mockRejectedValue(error)
    const req = createMockReq({ params: { id: 'missing-id' } })

    await clientsController.delete(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
  })
})