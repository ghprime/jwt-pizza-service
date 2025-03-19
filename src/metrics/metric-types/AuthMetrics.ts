import { createMetricsClass } from "./Metrics";

export enum AuthMetric {
  ACTIVE_USERS,
  AUTH_ATTEMPTS,
  AUTH_ATTEMPTS_SUCCESS,
  AUTH_ATTEMPTS_FAIL,
}

export const AuthMetrics = createMetricsClass([
  AuthMetric.ACTIVE_USERS, 
  AuthMetric.AUTH_ATTEMPTS, 
  AuthMetric.AUTH_ATTEMPTS_SUCCESS,
  AuthMetric.AUTH_ATTEMPTS_FAIL,
]);
