
import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';

if (process.env.OTEL_DIAG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const instanceId = process.env.GRAFANA_INSTANCE_ID?.trim();
const token = process.env.GRAFANA_OTLP_TOKEN?.trim();

let sdk: NodeSDK | undefined;

if (endpoint && instanceId && token) {
  const baseEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/v1\/(?:metrics|traces)$/, '');

  const auth = Buffer.from(`${instanceId}:${token}`, 'utf-8').toString('base64');

  const headers = {
    Authorization: `Basic ${auth}`,
  };

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'ecommerce-api',
      'service.instance.id': randomUUID(),
      'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT ?? 'dev',
    }),

    // Exportador de trazas
    traceExporter: new OTLPTraceExporter({
      url: `${baseEndpoint}/v1/traces`,
      headers,
    }),

    // Exportador de métricas
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${baseEndpoint}/v1/metrics`,
        headers,
      }),
      exportIntervalMillis: 15_000,
    }),

    // Instrumentación automática de Node.js y sus dependencias
    instrumentations: [
      getNodeAutoInstrumentations(),
    ],
  });

  sdk.start();

  console.log(JSON.stringify({
    telemetry: 'enabled',
    traces: 'enabled',
    metrics: 'enabled',
    hasEndpoint: true,
    hasInstanceId: true,
    hasToken: true,
    service: process.env.OTEL_SERVICE_NAME ?? 'ecommerce-api',
  }));
} else {
  console.log(JSON.stringify({
    telemetry: 'disabled',
    hasEndpoint: Boolean(endpoint),
    hasInstanceId: Boolean(instanceId),
    hasToken: Boolean(token),
  }));
}

// Permite cerrar OpenTelemetry de forma controlada desde la aplicación.
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
}
