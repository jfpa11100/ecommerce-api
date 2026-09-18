import express, { type Express } from 'express';
import { traceIdMiddleware } from './middlewares/trace-id.middleware.ts';
import { errorHandler } from './middlewares/error-handler.ts';
import { orchestrateRouter } from './routes/orchestrator.router.ts';
import { startResponseListener, stopResponseListener } from './queue/sqs-response-listener.ts';
import { worker } from './worker.ts';

const PORT = process.env.PORT || 3000;

const app: Express = express();

app.use(express.json());
app.use(traceIdMiddleware);
app.use(orchestrateRouter);
app.use(errorHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

startResponseListener();

const server = app.listen(PORT, () => {
  console.log(`Orchestrator on port ${PORT}`);
});

worker();

function shutdown(): void {
  stopResponseListener();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);