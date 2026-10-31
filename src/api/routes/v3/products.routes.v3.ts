import { Router } from 'express'
import { productsControllerV3 } from '../../modules/products/v3/products.controller.v3.ts'

const productsRouter = Router()

productsRouter.get('/', productsControllerV3.getAll)
productsRouter.get('/:id', productsControllerV3.getById)
productsRouter.query!('/', productsControllerV3.search)
productsRouter.post('/', productsControllerV3.create)
productsRouter.put('/:id', productsControllerV3.replace)
productsRouter.patch('/:id', productsControllerV3.patch)
productsRouter.delete('/:id', productsControllerV3.delete)

export default productsRouter
