    import { beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcrypt'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.ts'
import { clientsRepository } from '../clients.repository.ts'
import { clientsService } from '../clients.service.ts'

vi.mock('../clients.repository.ts', () => ({
  clientsRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}))

const mockedClientsRepository = vi.mocked(clientsRepository)
const mockedBcrypt = vi.mocked(bcrypt)

const fakeClient = {
  id: 'client-1',
  createdAt: new Date(),
  name: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'hashed-password',
  shipAddress: '123 Main St',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('clientsService.getAll', () => {
  it('returns all clients from the repository', async () => {
    mockedClientsRepository.findAll.mockResolvedValue([fakeClient])

    const result = await clientsService.getAll()

    expect(result).toEqual([fakeClient])
    expect(mockedClientsRepository.findAll).toHaveBeenCalledTimes(1)
  })
})

describe('clientsService.getById', () => {
  it('returns the client when it exists', async () => {
    mockedClientsRepository.findById.mockResolvedValue(fakeClient)

    const result = await clientsService.getById('client-1')

    expect(result).toEqual(fakeClient)
    expect(mockedClientsRepository.findById).toHaveBeenCalledWith('client-1')
  })

  it('throws NotFoundError when the client does not exist', async () => {
    mockedClientsRepository.findById.mockResolvedValue(undefined)

    await expect(clientsService.getById('missing-id')).rejects.toThrow(NotFoundError)
    await expect(clientsService.getById('missing-id')).rejects.toThrow('Client not found')
  })
})

describe('clientsService.searchClient', () => {
  it('returns the matching clients from the repository', async () => {
    mockedClientsRepository.search.mockResolvedValue([fakeClient])

    const filters = { name: 'John' }
    const result = await clientsService.searchClient(filters)

    expect(result).toEqual([fakeClient])
    expect(mockedClientsRepository.search).toHaveBeenCalledWith(filters)
  })
})

describe('clientsService.create', () => {
  const newClient = {
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'plain-password',
    shipAddress: '123 Main St',
  }

  it('throws ConflictError when the email already exists', async () => {
    mockedClientsRepository.findByEmail.mockResolvedValue(fakeClient)

    await expect(clientsService.create(newClient as any)).rejects.toThrow(ConflictError)
    await expect(clientsService.create(newClient as any)).rejects.toThrow('Email already exists')
    expect(mockedClientsRepository.create).not.toHaveBeenCalled()
    expect(mockedBcrypt.hash).not.toHaveBeenCalled()
  })

  it('hashes the password and creates the client when the email is new', async () => {
    mockedClientsRepository.findByEmail.mockResolvedValue(undefined)
    mockedBcrypt.hash.mockResolvedValue('hashed-password' as never)
    mockedClientsRepository.create.mockResolvedValue(fakeClient)

    const result = await clientsService.create(newClient as any)

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('plain-password', 10)
    expect(mockedClientsRepository.create).toHaveBeenCalledWith({
      ...newClient,
      password: 'hashed-password',
    })
    expect(result).toEqual(fakeClient)
  })
})

describe('clientsService.replace', () => {
  const replaceData = {
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'hashed-password',
    shipAddress: '123 Main St',
  }

  it('returns the updated client when it exists', async () => {
    mockedClientsRepository.update.mockResolvedValue(fakeClient)

    const result = await clientsService.replace('client-1', replaceData as any)

    expect(result).toEqual(fakeClient)
    expect(mockedClientsRepository.update).toHaveBeenCalledWith('client-1', replaceData)
  })

  it('throws NotFoundError when the client does not exist', async () => {
    mockedClientsRepository.update.mockResolvedValue(undefined)

    await expect(
      clientsService.replace('missing-id', replaceData as any),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('clientsService.patch', () => {
  it('throws BadRequestError when no fields are provided', async () => {
    await expect(clientsService.patch('client-1', {})).rejects.toThrow(BadRequestError)
    await expect(clientsService.patch('client-1', {})).rejects.toThrow(
      'No fields provided for update',
    )
    expect(mockedClientsRepository.update).not.toHaveBeenCalled()
  })

  it('returns the updated client when it exists', async () => {
    mockedClientsRepository.update.mockResolvedValue(fakeClient)

    const result = await clientsService.patch('client-1', { name: 'Jane' })

    expect(result).toEqual(fakeClient)
    expect(mockedClientsRepository.update).toHaveBeenCalledWith('client-1', { name: 'Jane' })
  })

  it('throws NotFoundError when the client does not exist', async () => {
    mockedClientsRepository.update.mockResolvedValue(undefined)

    await expect(
      clientsService.patch('missing-id', { name: 'Jane' }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('clientsService.delete', () => {
  it('deletes the client when it exists', async () => {
    mockedClientsRepository.delete.mockResolvedValue(true)

    await expect(clientsService.delete('client-1')).resolves.toBeUndefined()
    expect(mockedClientsRepository.delete).toHaveBeenCalledWith('client-1')
  })

  it('throws NotFoundError when the client does not exist', async () => {
    mockedClientsRepository.delete.mockResolvedValue(false)

    await expect(clientsService.delete('missing-id')).rejects.toThrow(NotFoundError)
  })
})