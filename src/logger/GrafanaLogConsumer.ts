import config from "../config";
import { ILogConsumer, Level } from "./ILogConsumer";

// [timestamp, log]
type GrafanaLog = [string, string];

export class GrafanaLogConsumer implements ILogConsumer {
  private info: GrafanaLog[] = [];
  private debug: GrafanaLog[] = [];
  private warn: GrafanaLog[] = [];
  private error: GrafanaLog[] = [];

  private static DEFAULT_INTERVAL = 5_000;

  private started: boolean = false;

  private intervalId!: NodeJS.Timeout;

  constructor() {
    this.start();
  }

  stop() {
    clearInterval(this.intervalId);
    this.started = false;
  }

  private start() {
    if (this.started) return;
    
    this.started = true;

    this.intervalId = setInterval(this.sendLogs.bind(this), GrafanaLogConsumer.DEFAULT_INTERVAL);
  }

  private async sendLogs() {
    const streams: { 
      stream: {
        level: Level;
        source: string;
      },
      values: GrafanaLog[];
    }[] = [];

    const possibleLogs: { logs: GrafanaLog[], level: Level }[] = [
      {
        logs: this.debug,
        level: Level.DEBUG,
      },
      {
        logs: this.error,
        level: Level.ERROR,
      },
      {
        logs: this.info,
        level: Level.INFO,
      },
      {
        logs: this.warn,
        level: Level.WARN,
      },
    ];

    for (const { logs, level } of possibleLogs) {
      if (!logs.length) continue;

      streams.push({
        stream: {
          level,
          source: config.grafana.source,
        },
        values: logs,
      });
    }

    this.debug = [];
    this.error = [];
    this.info = [];
    this.warn = [];

    if (!streams.length) {
      return;
    }

    try {
      const response = await fetch(config.grafana.logging.url, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.grafana.logging.userId}:${config.grafana.logging.apiKey}`,
        },
        
        body: JSON.stringify({ streams }),
      });

      if (!response.ok) {
        console.error("Failed to send logs to Loki:", response.statusText);
      }
    } catch (error) {
      console.error("Error sending logs to Loki:", error);
    }
  }

  async log(message: any, level: Level): Promise<void> {
    let logs: GrafanaLog[];

    switch (level) {
      case Level.DEBUG:
        logs = this.debug;
        break;
      case Level.ERROR:
        logs = this.error;
        break;
      case Level.INFO:
        logs = this.info;
        break;
      case Level.WARN:
        logs = this.warn;
        break;
      default:
        throw new Error(`Unknown log level ${level}`);
    }

    logs.push([
      `${Math.floor(Date.now() / 1000) * 1000000000}`,
      typeof message === "string" ? message : JSON.stringify(message),
    ]);
  }
}
