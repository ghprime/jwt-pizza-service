import { loadavg, cpus, totalmem, freemem } from "node:os";
import { ContextFactory } from "../../context";
import { AuthMetric, HttpMetric, LatencyMetric, LoggerMetric, PizzaMetric, SystemMetric } from "../metric-types";

export type CollectedMetrics = {
  active_users: number;
  auth_attempts: number;
  auth_attempts_success: number;
  auth_attempts_fail: number;
  get_requests: number;
  put_requests: number;
  post_requests: number;
  delete_requests: number;
  other_requests: number;
  server_error: number;
  service_latency: number;
  log_success: number,
  log_failed: number,
  pizza_latency: number;
  pizzas_sold: number;
  pizzas_failed: number;
  revenue: number;
  cpu_usage: number;
  memory_usage: number;
};

export class MetricsCollector {
  private static getCpuUsagePercentage() {
    const cpuUsage = loadavg()[0] / cpus().length;
    return +cpuUsage.toFixed(2) * 100;
  }
  
  private static getMemoryUsagePercentage() {
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return +memoryUsage.toFixed(2);
  }

  static async collect(): Promise<CollectedMetrics> {
    const metrics = await ContextFactory.context().metrics();

    metrics.system.set(SystemMetric.CPU, this.getCpuUsagePercentage());
    metrics.system.set(SystemMetric.MEM, this.getMemoryUsagePercentage());
    
    const collected: CollectedMetrics = {
      active_users: metrics.auth.get(AuthMetric.ACTIVE_USERS),
      auth_attempts: metrics.auth.get(AuthMetric.AUTH_ATTEMPTS),
      auth_attempts_success: metrics.auth.get(AuthMetric.AUTH_ATTEMPTS_SUCCESS),
      auth_attempts_fail: metrics.auth.get(AuthMetric.AUTH_ATTEMPTS_FAIL),
      get_requests: metrics.http.get(HttpMetric.GET_REQUESTS),
      put_requests: metrics.http.get(HttpMetric.PUT_REQUESTS),
      post_requests: metrics.http.get(HttpMetric.POST_REQUESTS),
      delete_requests: metrics.http.get(HttpMetric.DELETE_REQUESTS),
      other_requests: metrics.http.get(HttpMetric.OTHER_REQUESTS),
      server_error: metrics.http.get(HttpMetric.SERVER_ERROR),
      service_latency: metrics.latency.get(LatencyMetric.SERVICE_ENDPOINT),
      pizza_latency: metrics.latency.get(LatencyMetric.PIZZA_CREATION),
      log_failed: metrics.logs.get(LoggerMetric.LOG_FAILED),
      log_success: metrics.logs.get(LoggerMetric.LOG_SUCCEEDED),
      pizzas_sold: metrics.pizza.get(PizzaMetric.SOLD),
      pizzas_failed: metrics.pizza.get(PizzaMetric.CREATION_FAILURE),
      revenue: metrics.pizza.get(PizzaMetric.REVENUE),
      cpu_usage: metrics.system.get(SystemMetric.CPU),
      memory_usage: metrics.system.get(SystemMetric.MEM),
    };

    metrics.auth.set(AuthMetric.ACTIVE_USERS, collected.active_users);

    return collected;
  }
}
