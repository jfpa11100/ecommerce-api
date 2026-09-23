import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './sqs-client.ts';
import { config } from '../config.ts';
import type { RequestMessage, ResponseMessage } from '../shared/types.ts';
import { logger } from '../shared/logger.ts';

export async function sendRequestMessage(message: RequestMessage): Promise<void> {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: config.requestQueueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      traceId: { DataType: 'String', StringValue: message.traceId },
      target: { DataType: 'String', StringValue: message.target },
    },
  }));
  logger.info('Request sent to Requests queue', { traceId: message.traceId, target: message.target });
}

export async function sendResponseMessage(message: ResponseMessage): Promise<void> {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: config.responseQueueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      traceId: { DataType: 'String', StringValue: message.traceId },
    },
  }));
  logger.info('Response sent to Responses queue', { traceId: message.traceId, status: message.status });
}
