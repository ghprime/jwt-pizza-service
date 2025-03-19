import { createMetricsClass } from "./Metrics";

export enum LatencyMetric {
  PIZZA_CREATION,
  SERVICE_ENDPOINT,
}

export const LatencyMetrics = createMetricsClass([
  LatencyMetric.PIZZA_CREATION,
  LatencyMetric.SERVICE_ENDPOINT,
]);
