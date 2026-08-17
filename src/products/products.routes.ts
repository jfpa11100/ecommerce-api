import { Router } from 'express'
import { productsController } from './products.controller.ts'

const productsRouter = Router()

productsRouter.get('/', productsController.getAll)
productsRouter.get('/:id', productsController.getById)
productsRouter.post('/', productsController.create)

export default productsRouter