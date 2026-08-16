import type { NewClient } from '../db/schemas/client.schema.ts'
import { BadRequestError, ConflictError, NotFoundError } from '../shared/errors.ts'
import { clientsRepository, type ClientSearchFilters } from './clients.repository.ts'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10 

export const clientsService = {
  async getAll() {
    return clientsRepository.findAll()
  },

  async getById(id: string) {
    const client = await clientsRepository.findById(id)
    if (!client) throw new NotFoundError('Client not found')
    return client
  },

  async searchClient(filters: ClientSearchFilters) {
    return clientsRepository.search(filters)
  },

  async create(data: NewClient) {
    const existing = await clientsRepository.findByEmail(data.email)
    if (existing) throw new ConflictError('Email already exists')
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS)
    return clientsRepository.create({ ...data, password: hashedPassword })
  },

  // for PUT: entire object
  async replace(id: string, data: Required<Omit<NewClient, 'id' | 'createdAt'>>) {
    const client = await clientsRepository.update(id, data)
    if (!client) throw new NotFoundError('Client not found')
    return client
  },

  // for PATCH: parcial object
  async patch(id: string, data: Partial<Omit<NewClient, 'id' | 'createdAt'>>) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('No fields provided for update')
    }
    const client = await clientsRepository.update(id, data)
    if (!client) throw new NotFoundError('Client not found')
    return client
  },

  async delete(id: string) {
    const deleted = await clientsRepository.delete(id)
    if (!deleted) throw new NotFoundError('Client not found')
  },
}