import { createMetricsClass } from "./Metrics";

export enum SystemMetric {
  CPU,
  MEM,
}

export const SystemMetrics = createMetricsClass([
  SystemMetric.CPU,
  SystemMetric.MEM,
]);
