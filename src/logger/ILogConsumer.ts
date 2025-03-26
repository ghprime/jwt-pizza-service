export enum Level {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface ILogConsumer {
  log(message: any, level: Level): Promise<void>;
};
