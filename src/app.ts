import 'dotenv/config'
import express, { type Express, type Request, type Response } from 'express';
import clientsRouter from './clients/clients.routes.ts';

const PORT = process.env.PORT || 3000;

const app: Express = express();
app.use(express.json())

// Routes
app.use('/clients', clientsRouter)

app.listen(PORT);