import { ILogConsumer, Level } from "./ILogConsumer";

export type Log = {
  type: "sql" | "http" | "factory";
} & Record<string | number, any>;

export class Logger {
  private logConsumers: ILogConsumer[] = [];

  private static _instance: Logger;

  static getInstance() {
    if (!this._instance) this._instance = new Logger();

    return this._instance;
  }

  public addLogConsumer(logConsumer: ILogConsumer) {
    this.logConsumers.push(logConsumer);
  }

  private log(rawMessage: Log, level: Level) {
    const responses: ReturnType<ILogConsumer["log"]>[] = [];

    let message: string = JSON.stringify(rawMessage);

    message = message.replace(/\\"password\\":\s*\\"[^"]*\\"/g, "\\\"password\\\": \\\"*****\\\"");

    for (const logConsumer of this.logConsumers) {
      responses.push(logConsumer.log(message, level));
    }

    try {
      Promise.allSettled(responses);
    } catch (error) {
      console.error("Error sending logs: ", error);
    }
  }

  public info(message: Log) {
    return this.log(message, Level.INFO);
  }

  public debug(message: Log) {
    return this.log(message, Level.DEBUG);
  }

  public warn(message: Log) {
    return this.log(message, Level.WARN);
  }

  public error(message: Log) {
    return this.log(message, Level.ERROR);
  }
}
