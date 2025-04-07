import { createMetricsClass } from "./Metrics";

export enum HttpMetric {
  GET_REQUESTS,
  PUT_REQUESTS,
  POST_REQUESTS,
  DELETE_REQUESTS,
  OTHER_REQUESTS,
  SERVER_ERROR,
}

export const HttpMetrics = createMetricsClass([
  HttpMetric.GET_REQUESTS,
  HttpMetric.PUT_REQUESTS,
  HttpMetric.POST_REQUESTS,
  HttpMetric.DELETE_REQUESTS,
  HttpMetric.OTHER_REQUESTS,
  HttpMetric.SERVER_ERROR,
]);
