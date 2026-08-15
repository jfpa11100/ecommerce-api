import { Router } from 'express'
import { clientsController } from './clients.controller.ts'

const router = Router()

router.get('/', clientsController.getClients)
router.get('/:id', clientsController.getById)
router.post('/', clientsController.create)
router.put('/:id', clientsController.replace)
router.patch('/:id', clientsController.patch)
router.delete('/:id', clientsController.delete)
router.query("/", clientsController.queryClients);

export default router