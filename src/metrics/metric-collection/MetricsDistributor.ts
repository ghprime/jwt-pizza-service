import config from "../../config";
import { CollectedMetrics } from "./MetricsCollector";

type MetricType = "sum" | "gauge" | "histogram";
type MetricUnit = "1" | "s" | "ms" | "%" | "By" | "MiBy";
type MetricValueType = "asInt" | "asDouble";

const normal = {
  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
  isMonotonic: true,
};

export class MetricsDistributor {
  private static types: Partial<Record<MetricType, (keyof CollectedMetrics)[]>> = {
    "sum": [
      "active_users",
      "auth_attempts",
      "auth_attempts_success",
      "auth_attempts_fail",
      "get_requests",
      "put_requests",
      "post_requests",
      "delete_requests",
      "other_requests",
      "service_latency",
      "pizza_latency",
      "pizzas_sold",
      "pizzas_failed",
      "revenue",
    ],
    "gauge": [
      "cpu_usage",
      "memory_usage",
    ],
  };

  private static options: Record<(keyof CollectedMetrics), Record<string, any>> = {
    "active_users": {
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: false,
    },
    "auth_attempts": normal,
    "auth_attempts_success": normal,
    "auth_attempts_fail": normal,
    "get_requests": normal,
    "put_requests": normal,
    "post_requests": normal,
    "delete_requests": normal,
    "other_requests": normal,
    "service_latency": normal,
    "pizza_latency": normal,
    "pizzas_sold": normal,
    "pizzas_failed": normal,
    "revenue": normal,
    "cpu_usage":{},
    "memory_usage":{},
  };
  
  private static units: Record<(keyof CollectedMetrics), MetricUnit> = {
    "active_users": "1",
    "auth_attempts": "1",
    "auth_attempts_success": "1",
    "auth_attempts_fail": "1",
    "get_requests": "1",
    "put_requests": "1",
    "post_requests": "1",
    "delete_requests": "1",
    "other_requests": "1",
    "service_latency": "ms",
    "pizza_latency": "ms",
    "pizzas_sold": "1",
    "pizzas_failed": "1",
    "revenue": "1",
    "cpu_usage": "%",
    "memory_usage": "%",
  };

  private static valueTypes: Record<(keyof CollectedMetrics), MetricValueType> = {
    "active_users": "asInt",
    "auth_attempts": "asInt",
    "auth_attempts_success": "asInt",
    "auth_attempts_fail": "asInt",
    "get_requests": "asInt",
    "put_requests": "asInt",
    "post_requests": "asInt",
    "delete_requests": "asInt",
    "other_requests": "asInt",
    "service_latency": "asInt",
    "pizza_latency": "asInt",
    "pizzas_sold": "asInt",
    "pizzas_failed": "asInt",
    "revenue": "asDouble",
    "cpu_usage": "asDouble",
    "memory_usage": "asDouble",
  };

  static async distribute(metrics: CollectedMetrics) {
    console.log(metrics);

    const granfanaMetrics: any[] = [];
    
    for (const type of Object.keys(this.types)) {
      for (const metricName of this.types[type as MetricType]!) {
        granfanaMetrics.push(
          this.createGranfanaMetric(
            metricName, 
            metrics[metricName], 
            type as MetricType, 
            this.units[metricName],
            this.valueTypes[metricName],
            this.options[metricName],
          ),
        );
      }
    }

    const body = JSON.stringify({
      resourceMetrics: [{
        scopeMetrics: [{
          metrics: granfanaMetrics,
        }],
      }],
    });

    try {
      const response = await fetch(`${config.metrics.url}`, {
        method: "POST",
        body: body,
        headers: { Authorization: `Bearer ${config.metrics.apiKey}`, "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        console.log(`Failed to push metrics data to Granfana: ${text}\n${body}`);
      } else {
        console.log("Pushed metrics");
      }
    } catch (err) {
      console.error("Error pushing metrics:", err);
    }
  }

  private static createGranfanaMetric(
    metricName: string, 
    metricValue: number, 
    type: MetricType, 
    unit: MetricUnit, 
    valueType: MetricValueType,
    options: Record<string, any>,
  ) {
    const metric = {
      name: metricName,
      unit: unit,
      [type]: {
        dataPoints: [{
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [{
            key: "source",
            value: { "stringValue": config.metrics.source },
          }],
        }],
        ...options,
      },
    };

    return metric;
  }
}
