import { Router } from "express"
import clientsRouter from "./clients.routes.v2.ts"
import commerceRouter from "./commerce.routes.v2.ts"
import productsRouter from "./products.routes.v2.ts"


const v2Router = Router()

v2Router.use('/clients', clientsRouter)
v2Router.use('/commerce', commerceRouter)
v2Router.use('/products', productsRouter)

export default v2Router