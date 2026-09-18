import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './sqs-client.ts';
import { config } from '../config.ts';
import type { ResponseMessage } from '../shared/types.ts';
import { resolvePendingResponse } from '../shared/pending-requests.ts';
import { logger } from '../shared/logger.ts';

let running = false;

export function startResponseListener(): void {
  running = true;
  void poll();
}

export function stopResponseListener(): void {
  running = false;
}

async function poll(): Promise<void> {
  while (running) {
    try {
      const result = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: config.responseQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 15, // long polling
        MessageAttributeNames: ['traceId'],
      }));

      for (const message of result.Messages ?? []) {
        if (!message.Body || !message.ReceiptHandle) continue;

        try {
          const parsed = JSON.parse(message.Body) as ResponseMessage;
          resolvePendingResponse(parsed);
        } catch (error) {
          logger.error('Error parsing the response message', { error: String(error) });
        }

        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: config.responseQueueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }));
      }
    } catch (error) {
      logger.error('Error consulting the response queue', { error: String(error) });
      // if error, wait to try again evitating queue saturation.
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
