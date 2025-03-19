import { MetricsCollector } from "./MetricsCollector";
import { MetricsDistributor } from "./MetricsDistributor";

export class MetricsJob {
  private static DEFAULT_INTERVAL = 5_000;
  private static interval: number = this.DEFAULT_INTERVAL;
  private static started = false;
  private static intervalId: NodeJS.Timeout;

  static start(interval = -1) {
    if (this.started) clearInterval(this.intervalId);
    if (interval > 0) this.interval = interval;

    this.intervalId = setInterval(async () => {
      const metrics = await MetricsCollector.collect();

      await MetricsDistributor.distribute(metrics);
    }, this.interval);
  }
}
