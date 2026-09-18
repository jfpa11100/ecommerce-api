import express, { type Express } from 'express';
import { traceIdMiddleware } from './middlewares/trace-id.middleware.ts';
import { errorHandler } from './middlewares/error-handler.ts';

const PORT = process.env.PORT || 3000;

const app: Express = express();

app.use(express.json());
app.use(traceIdMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Orquestador escuchando en el puerto ${PORT}`);
});