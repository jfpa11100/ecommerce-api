import type { NewClient } from '../db/schemas/client.schema.ts'
import { ConflictError, NotFoundError } from '../shared/errors.ts'
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
    if (existing) throw new ConflictError('El email ya está registrado')
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS)
    return clientsRepository.create({ ...data, password: hashedPassword })
  },
}