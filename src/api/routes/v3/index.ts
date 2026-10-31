import { Router } from 'express'
import clientsRouter from '../v2/clients.routes.v2.ts'
import commerceRouter from '../v2/commerce.routes.v2.ts'
import productsRouter from './products.routes.v3.ts'

const v3Router = Router()

v3Router.use('/clients', clientsRouter)
v3Router.use('/commerce', commerceRouter)
v3Router.use('/products', productsRouter)

export default v3Router
