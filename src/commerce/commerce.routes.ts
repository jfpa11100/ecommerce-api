import { Router } from 'express'
import { commerceController } from './commerce.controller.ts'

const commerceRouter = Router()

commerceRouter.get('/', commerceController.getAll)
commerceRouter.get('/:nit', commerceController.getByNit)
commerceRouter.query!('/search', commerceController.queryCommerce)
commerceRouter.post('/', commerceController.create)
commerceRouter.put('/:nit', commerceController.replace)
commerceRouter.patch('/:nit', commerceController.patch)
commerceRouter.delete('/:nit', commerceController.delete)

export default commerceRouter