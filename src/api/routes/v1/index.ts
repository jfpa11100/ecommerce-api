import { Router } from "express"
import clientsRouter from "./clients.routes.ts"
import commerceRouter from "./commerce.routes.ts"
import productsRouter from "./products.routes.ts"


const v1Router = Router()

v1Router.use('/clients', clientsRouter)
v1Router.use('/commerce', commerceRouter)
v1Router.use('/products', productsRouter)

export default v1Router