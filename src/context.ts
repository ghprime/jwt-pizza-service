import { DatabaseDAO, MySqlDAO } from "./database";
import { 
  AuthMetric, 
  AuthMetrics,
  HttpMetric, 
  HttpMetrics, 
  LatencyMetric,
  LatencyMetrics, 
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
    pizza: Metrics<PizzaMetric>;
    system: Metrics<SystemMetric>;
  }>;
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
        pizza: PizzaMetrics.getInstance(),
        system: SystemMetrics.getInstance(),
      }),
    };

    return this._context;
  }
};
