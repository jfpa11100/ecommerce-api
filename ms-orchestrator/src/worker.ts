import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './queue/sqs-client.ts';
import { config } from './config.ts';
import type { RequestMessage } from './shared/types.ts';
import axios from 'axios';
import { sendResponseMessage } from './queue/sqs-producer.ts';
import { logger } from './shared/logger.ts';


let running = true;
process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });

export async function worker(): Promise<void> {
  logger.info('Worker/dispatcher set, hearing requests from queue');

  while (running) {
    try {
      const result = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: config.requestQueueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      }));

      for (const message of result.Messages ?? []) {
        if (!message.Body || !message.ReceiptHandle) continue;

        await handleMessage(JSON.parse(message.Body) as RequestMessage);

        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: config.requestQueueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }));
      }
    } catch (error) {
      logger.error('Error consuming queue of requests', { error: String(error) });
      await sleep(2000);
    }
  }
}

async function handleMessage(message: RequestMessage): Promise<void> {
  const baseUrl = config.clusters[message.target];
  const url = `${baseUrl}${message.path}`;

  logger.info('Handling request to target cluster\n', {
    traceId: message.traceId,
    target: message.target,
    url,
  });

  try {
    const response = await axios.request({
      url,
      method: message.method,
      data: message.payload,
      headers: { 'x-trace-id': message.traceId },
      validateStatus: () => true,
    });

    await sendResponseMessage({
      traceId: message.traceId,
      status: response.status,
      body: response.data,
    });
  } catch (error) {
    logger.error('Error calling target cluster', { traceId: message.traceId, error: String(error) });
    await sendResponseMessage({
      traceId: message.traceId,
      status: 502,
      body: null,
      error: 'Could not reach the target cluster',
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
