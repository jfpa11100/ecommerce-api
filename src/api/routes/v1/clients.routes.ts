import { Router } from 'express'
import { clientsController } from '../../modules/clients/v1/clients.controller.ts'


const clientsRouter = Router()

clientsRouter.get('/', clientsController.getClients)
clientsRouter.get('/:id', clientsController.getById)
clientsRouter.post('/', clientsController.create)
clientsRouter.put('/:id', clientsController.replace)
clientsRouter.patch('/:id', clientsController.patch)
clientsRouter.delete('/:id', clientsController.delete)
clientsRouter.query!("/", clientsController.queryClients);

export default clientsRouter