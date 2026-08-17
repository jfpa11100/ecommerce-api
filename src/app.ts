import 'dotenv/config'
import express, { type Express } from 'express';
import clientsRouter from './clients/clients.routes.ts';
import commerceRouter from './commerce/commerce.routes.ts';
import productsRouter  from './products/products.routes.ts';

const PORT = process.env.PORT || 3000;

const app: Express = express();
app.use(express.json())

// Routes
app.use('/clients', clientsRouter)
app.use('/commerce', commerceRouter)
app.use('/products', productsRouter)

app.listen(PORT);