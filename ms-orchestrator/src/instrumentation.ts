import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { logger } from "./shared/logger.ts";

console.log('========== OTEL INIT ==========');
new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME!,
	}),
	traceExporter: new OTLPTraceExporter(),
	metricReader: new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter(),
		exportIntervalMillis: 30000,
	}),
	instrumentations: [
		getNodeAutoInstrumentations({
			"@opentelemetry/instrumentation-aws-sdk": {
				sqsExtractContextPropagationFromPayload: true,
			},
		}),
	],
}).start();

logger.info(`OpenTelemetry initialized for service: ${process.env.OTEL_SERVICE_NAME} \n 'OTEL_EXPORTER_OTLP_HEADERS:',
  ${process.env.OTEL_EXPORTER_OTLP_HEADERS ? "[PRESENT]" : "[MISSING]"}`);
