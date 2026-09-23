import { SQSClient } from '@aws-sdk/client-sqs';
import { config } from '../config.ts';


export const sqsClient = new SQSClient({ region: config.awsRegion });
