import { Router } from 'express'
import { commerceController } from './commerce.controller.ts'

const router = Router()

router.get('/', commerceController.getAll)
router.get('/:nit', commerceController.getByNit)
router.query!('/search', commerceController.queryCommerce)
router.post('/', commerceController.create)
router.put('/:nit', commerceController.replace)
router.patch('/:nit', commerceController.patch)
router.delete('/:nit', commerceController.delete)

export default router