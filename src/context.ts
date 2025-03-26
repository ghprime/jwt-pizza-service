import { DatabaseDAO, MySqlDAO } from "./database";
import { Logger } from "./logger";
import { 
  AuthMetric, 
  AuthMetrics,
  HttpMetric, 
  HttpMetrics, 
  LatencyMetric,
  LatencyMetrics, 
  LoggerMetric, 
  LoggerMetrics, 
  Metrics, 
  PizzaMetric, 
  PizzaMetrics, 
  SystemMetric, 
  SystemMetrics, 
} from "./metrics";

export interface Context {
  dao(): Promise<DatabaseDAO>;
  metrics(): Promise<{
    auth: Metrics<AuthMetric>;
    http: Metrics<HttpMetric>;
    latency: Metrics<LatencyMetric>;
    logs: Metrics<LoggerMetric>;
    pizza: Metrics<PizzaMetric>;
    system: Metrics<SystemMetric>;
  }>;
  logging(): Promise<Logger>;
}

export class ContextFactory {
  private static _context?: Context;

  static setContext(context: Context) {
    this._context = context;
  }

  static resetContext() {
    this._context = undefined;
  }

  static context(): Context {
    if (!this._context) this._context = {
      dao: () => MySqlDAO.getInstance(),
      metrics: () => Promise.resolve({
        auth: AuthMetrics.getInstance(),
        http: HttpMetrics.getInstance(),
        latency: LatencyMetrics.getInstance(),
        logs: LoggerMetrics.getInstance(),
        pizza: PizzaMetrics.getInstance(),
        system: SystemMetrics.getInstance(),
      }),
      logging: () => Promise.resolve(Logger.getInstance()),
    };

    return this._context;
  }
};
