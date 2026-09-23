import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const headers = {
  Authorization: `Basic ${Buffer.from(
    `${process.env.GRAFANA_OTLP_USER}:${process.env.GRAFANA_OTLP_TOKEN}`
  ).toString('base64')}`,
};

new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME!,
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.GRAFANA_OTLP_ENDPOINT}/v1/traces`,
    headers,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${process.env.GRAFANA_OTLP_ENDPOINT}/v1/metrics`,
      headers,
    }),
    exportIntervalMillis: 30000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
}).start();