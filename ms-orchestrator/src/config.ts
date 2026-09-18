import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing Environment Variable: ${name}`);
  }
  return value;
}

export const config = {
  awsRegion: required('AWS_REGION'),
  requestQueueUrl: required('REQUEST_QUEUE_URL'),
  responseQueueUrl: required('RESPONSE_QUEUE_URL'),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 25000),
  clusters: {
    aws: required('AWS_CLUSTER_URL'),
    gcp: required('GCP_CLUSTER_URL'),
    oci: required('OCI_CLUSTER_URL'),
  },
} as const;

export type ClusterTarget = keyof typeof config.clusters;

export function isClusterTarget(value: string): value is ClusterTarget {
  return value in config.clusters;
}
