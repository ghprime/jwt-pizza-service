import { createMetricsClass } from "./Metrics";

export enum PizzaMetric {
  SOLD,
  CREATION_FAILURE,
  REVENUE,
}

export const PizzaMetrics = createMetricsClass([
  PizzaMetric.SOLD,
  PizzaMetric.CREATION_FAILURE,
  PizzaMetric.REVENUE,
]);
