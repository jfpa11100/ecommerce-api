import { randomUUID } from 'node:crypto';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';

if (process.env.OTEL_DIAG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const instanceId = process.env.GRAFANA_INSTANCE_ID;
const token = process.env.GRAFANA_OTLP_TOKEN;

let meterProvider: MeterProvider | undefined;

// Si faltan las variables (por ejemplo, en local) las métricas quedan inactivas y la API funciona igual
if (endpoint && instanceId && token) {
  const auth = Buffer.from(`${instanceId}:${token}`).toString('base64');

  meterProvider = new MeterProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'ecommerce-api',
      'service.instance.id': randomUUID(), // distingue cada tarea de ECS
      'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT ?? 'dev',
    }),
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${endpoint.replace(/\/$/, '')}/v1/metrics`,
          headers: { Authorization: `Basic ${auth}` },
        }),
        exportIntervalMillis: 15_000,
      }),
    ],
  });

  metrics.setGlobalMeterProvider(meterProvider);
  registerInstrumentations({
    instrumentations: [new RuntimeNodeInstrumentation()], // event loop, GC, heap
    meterProvider,
  });
}

console.log(
  JSON.stringify({
    telemetry: meterProvider ? 'enabled' : 'disabled',
    hasEndpoint: Boolean(endpoint),
    hasInstanceId: Boolean(instanceId),
    hasToken: Boolean(token),
    service: process.env.OTEL_SERVICE_NAME,
  }),
);

const meter = metrics.getMeter('ecommerce-api');

export const httpDuration = meter.createHistogram('http.server.request.duration', {
  unit: 's',
  description: 'Duración de las peticiones HTTP atendidas',
  advice: { explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] },
});

export const httpActive = meter.createUpDownCounter('http.server.active_requests', {
  unit: '{request}',
  description: 'Peticiones en curso',
});

export const faultInjected = meter.createCounter('chaos.fault.injected', {
  unit: '{fault}',
  description: 'Fallos inyectados por el interruptor de caos',
});

export async function shutdownTelemetry(): Promise<void> {
  if (!meterProvider) return;
  await Promise.race([meterProvider.shutdown(), new Promise((r) => setTimeout(r, 5000))]);
}