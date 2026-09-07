import 'dotenv/config'
import express, { type Express } from 'express';
import { errorHandler } from './middlewares/error-handler.ts';
import v1Router from './api/routes/v1/index.ts';

const PORT = process.env.PORT || 3000;

const app: Express = express();
app.use(express.json())

// Routes
app.use('/api/v1', v1Router)

app.use(errorHandler)

app.listen(PORT);