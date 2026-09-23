import { Router } from 'express'
import { productsController } from '../../modules/products/v2/products.controller.v2.ts'


const productsRouter = Router()

productsRouter.get('/', productsController.getAll)
productsRouter.get('/:id', productsController.getById)
productsRouter.query!('/', productsController.search)
productsRouter.post('/', productsController.create)
productsRouter.put('/:id', productsController.replace)
productsRouter.patch('/:id', productsController.patch)
productsRouter.delete('/:id', productsController.delete)

export default productsRouter