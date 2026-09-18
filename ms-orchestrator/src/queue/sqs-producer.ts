import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './sqs-client.ts';
import { config } from '../config.ts';
import type { RequestMessage, ResponseMessage } from '../shared/types.ts';

export async function sendRequestMessage(message: RequestMessage): Promise<void> {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: config.requestQueueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      traceId: { DataType: 'String', StringValue: message.traceId },
      target: { DataType: 'String', StringValue: message.target },
    },
  }));
}

export async function sendResponseMessage(message: ResponseMessage): Promise<void> {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: config.responseQueueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      traceId: { DataType: 'String', StringValue: message.traceId },
    },
  }));
}
