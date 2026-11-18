
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('ecommerce-api');

export const httpDuration = meter.createHistogram('http.server.request.duration', {
  unit: 's',
  description: 'Duración de las peticiones HTTP atendidas',
  advice: {
    explicitBucketBoundaries: [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25,
      0.5, 1, 2.5, 5, 10,
    ],
  },
});

export const httpActive = meter.createUpDownCounter('http.server.active_requests', {
  unit: '{request}',
  description: 'Peticiones en curso',
});

export const faultInjected = meter.createCounter('chaos.fault.injected', {
  unit: '{fault}',
  description: 'Fallos inyectados por el interruptor de caos',
});

export { shutdownTelemetry } from '../instrumentation.ts';
