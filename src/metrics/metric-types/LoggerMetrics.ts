import { createMetricsClass } from "./Metrics";

export enum LoggerMetric {
  LOG_FAILED,
  LOG_SUCCEEDED,
}

export const LoggerMetrics = createMetricsClass([
  LoggerMetric.LOG_FAILED,
  LoggerMetric.LOG_SUCCEEDED,
]);
