import type { ResponseMessage } from "./types.ts";

interface PendingEntry {
  resolve: (value: ResponseMessage) => void;
  timeout: NodeJS.Timeout;
}

const pending = new Map<string, PendingEntry>();

// !IMPORTANTE: Este mapa vive en memoria de una sola instancia del proceso.
// Si el orquestador corre con más de una réplica, la respuesta puede llegar a
// una replica distinta a la que registro la promesa pendiente y esta nunca se
// resolvería. Para escalar horizontalmente:
//      Mover este estado a algo compartido (ej. Redis con pub/sub): al recibir
//      la respuesta, publicar en un canal Redis con el trace-id y cualquier
//      replica que tenga esa promesa pendiente la resuelve al escuchar el canal.

export function waitForResponse(traceId: string, timeoutMs: number): Promise<ResponseMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(traceId);
      reject(new Error('timeout waiting for the response from the destination cluster'));
    }, timeoutMs);

    pending.set(traceId, { resolve, timeout });
  });
}

export function resolvePendingResponse(message: ResponseMessage): boolean {
  const entry = pending.get(message.traceId);
  if (!entry) {
    return false;
  }
  clearTimeout(entry.timeout);
  pending.delete(message.traceId);
  entry.resolve(message);
  return true;
}
