import type { ClusterTarget } from "../config.ts";

export interface RequestMessage {
  traceId: string;
  target: ClusterTarget;
  method: string;
  path: string;
  payload: unknown;
}

export interface ResponseMessage {
  traceId: string;
  status: number;
  body: unknown;
  error?: string;
}