export interface Metrics<MetricType extends string | number | symbol> {
  inc(metricType: MetricType): void;
  dec(metricType: MetricType): void;
  add(metricType: MetricType, num: number): void;
  set(metricType: MetricType, num: number): void;
  get(metricType: MetricType): number;
  reset(): void;
}

export const createMetricsClass = <MetricsType extends string | number | symbol>(metricsTypes: MetricsType[]) => {
  class MetricsImple implements Metrics<MetricsType> {
    private metrics: Record<MetricsType, number> = {} as Record<MetricsType, number>;

    constructor() {
      for (const metric of metricsTypes) {
        this.metrics[metric] = 0;
      }
    }

    inc(metricType: MetricsType) {
      ++this.metrics[metricType];
    }
  
    dec(metricType: MetricsType) {
      --this.metrics[metricType];
    }

    add(meticType: MetricsType, num: number) {
      this.metrics[meticType] += num;
    }
  
    set(metricType: MetricsType, count: number) {
      this.metrics[metricType] = count;
    }
  
    get(metricType: MetricsType) {
      return this.metrics[metricType];
    }

    reset(): void {
      for (const metric of metricsTypes) {
        this.metrics[metric] = 0;
      }
    }
  };

  class MetricsContainer {
    private static _instance: Metrics<MetricsType>;

    public static getInstance() {
      if (!this._instance) this._instance = new MetricsImple();
      return this._instance;
    }

    public static createInstance() {
      return new MetricsImple();
    }
  }

  return MetricsContainer;
};
