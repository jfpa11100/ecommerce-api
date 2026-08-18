import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.ts'
import { commerceRepository } from '../commerce.repository.ts'
import { commerceService } from '../commerce.service.ts'

vi.mock('../commerce.repository.ts', () => ({
  commerceRepository: {
    findAll: vi.fn(),
    findByNit: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedCommerceRepository = vi.mocked(commerceRepository)

const fakeCommerce = {
  nit: '123456789',
  legalName: 'ACME Corp',
  shortName: 'ACME',
  address: 'Main St 123',
  contactNumber: '3000000000',
  email: 'contact@acme.com',
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('commerceService.getAll', () => {
  it('returns all commerces from the repository', async () => {
    mockedCommerceRepository.findAll.mockResolvedValue([fakeCommerce])

    const result = await commerceService.getAll()

    expect(result).toEqual([fakeCommerce])
    expect(mockedCommerceRepository.findAll).toHaveBeenCalledTimes(1)
  })
})

describe('commerceService.getByNit', () => {
  it('returns the commerce when it exists', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)

    const result = await commerceService.getByNit('123456789')

    expect(result).toEqual(fakeCommerce)
    expect(mockedCommerceRepository.findByNit).toHaveBeenCalledWith('123456789')
  })

  it('throws NotFoundError when the commerce does not exist', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(undefined)

    await expect(commerceService.getByNit('missing-nit')).rejects.toThrow(NotFoundError)
    await expect(commerceService.getByNit('missing-nit')).rejects.toThrow('Commerce not found')
  })
})

describe('commerceService.searchCommerce', () => {
  it('returns the matching commerces from the repository', async () => {
    mockedCommerceRepository.search.mockResolvedValue([fakeCommerce])

    const filters = { legalName: 'ACME' }
    const result = await commerceService.searchCommerce(filters)

    expect(result).toEqual([fakeCommerce])
    expect(mockedCommerceRepository.search).toHaveBeenCalledWith(filters)
  })
})

describe('commerceService.create', () => {
  const newCommerce = {
    nit: '123456789',
    legalName: 'ACME Corp',
    shortName: 'ACME',
    address: 'Main St 123',
    contactNumber: '3000000000',
    email: 'contact@acme.com',
  }

  it('throws ConflictError when a commerce with the same NIT already exists', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(fakeCommerce)

    await expect(commerceService.create(newCommerce as any)).rejects.toThrow(ConflictError)
    await expect(commerceService.create(newCommerce as any)).rejects.toThrow(
      'Commerce with this NIT already exists',
    )
    expect(mockedCommerceRepository.create).not.toHaveBeenCalled()
  })

  it('creates the commerce when the NIT is new', async () => {
    mockedCommerceRepository.findByNit.mockResolvedValue(undefined)
    mockedCommerceRepository.create.mockResolvedValue(fakeCommerce)

    const result = await commerceService.create(newCommerce as any)

    expect(mockedCommerceRepository.findByNit).toHaveBeenCalledWith('123456789')
    expect(mockedCommerceRepository.create).toHaveBeenCalledWith(newCommerce)
    expect(result).toEqual(fakeCommerce)
  })
})

describe('commerceService.replace', () => {
  const replaceData = {
    legalName: 'ACME Corp',
    shortName: 'ACME',
    address: 'Main St 123',
    contactNumber: '3000000000',
    email: 'contact@acme.com',
  }

  it('returns the updated commerce when it exists', async () => {
    mockedCommerceRepository.update.mockResolvedValue(fakeCommerce)

    const result = await commerceService.replace('123456789', replaceData as any)

    expect(result).toEqual(fakeCommerce)
    expect(mockedCommerceRepository.update).toHaveBeenCalledWith('123456789', replaceData)
  })

  it('throws NotFoundError when the commerce does not exist', async () => {
    mockedCommerceRepository.update.mockResolvedValue(undefined)

    await expect(
      commerceService.replace('missing-nit', replaceData as any),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('commerceService.patch', () => {
  it('throws BadRequestError when no fields are provided', async () => {
    await expect(commerceService.patch('123456789', {})).rejects.toThrow(BadRequestError)
    await expect(commerceService.patch('123456789', {})).rejects.toThrow(
      'No fields provided for update',
    )
    expect(mockedCommerceRepository.update).not.toHaveBeenCalled()
  })

  it('returns the updated commerce when it exists', async () => {
    mockedCommerceRepository.update.mockResolvedValue(fakeCommerce)

    const result = await commerceService.patch('123456789', { address: 'New Address' })

    expect(result).toEqual(fakeCommerce)
    expect(mockedCommerceRepository.update).toHaveBeenCalledWith('123456789', {
      address: 'New Address',
    })
  })

  it('throws NotFoundError when the commerce does not exist', async () => {
    mockedCommerceRepository.update.mockResolvedValue(undefined)

    await expect(
      commerceService.patch('missing-nit', { address: 'New Address' }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('commerceService.delete', () => {
  it('deletes the commerce when it exists', async () => {
    mockedCommerceRepository.delete.mockResolvedValue(true)

    await expect(commerceService.delete('123456789')).resolves.toBeUndefined()
    expect(mockedCommerceRepository.delete).toHaveBeenCalledWith('123456789')
  })

  it('throws NotFoundError when the commerce does not exist', async () => {
    mockedCommerceRepository.delete.mockResolvedValue(false)

    await expect(commerceService.delete('missing-nit')).rejects.toThrow(NotFoundError)
  })
})
