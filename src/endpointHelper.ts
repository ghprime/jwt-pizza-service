import { NextFunction, Request, Response } from "express";
import { ContextFactory } from "./context";
import { HttpMetric, LatencyMetric } from "./metrics";
import { ChaosManager } from "./chaos";

export class StatusCodeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };

export const setLocals = asyncHandler(async (req, res, next) => {
  const dao = await ContextFactory.context().dao();
  const metrics = await ContextFactory.context().metrics();
  const logger = await ContextFactory.context().logging();
  res.locals.dao = dao;
  res.locals.metrics = metrics;
  res.locals.logger = logger;

  res.locals.chaos = ChaosManager.getInstance().hasChaos(req.path, req.method);

  next();
});

export const trackHttpMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    res.locals.metrics.latency.add(
      LatencyMetric.SERVICE_ENDPOINT,
      Date.now() - start,
    );
  });

  let method: HttpMetric;

  switch (req.method) {
    case "GET":
      method = HttpMetric.GET_REQUESTS;
      break;
    case "PUT":
      method = HttpMetric.PUT_REQUESTS;
      break;
    case "POST":
      method = HttpMetric.POST_REQUESTS;
      break;
    case "DELETE":
      method = HttpMetric.DELETE_REQUESTS;
      break;
    default:
      method = HttpMetric.OTHER_REQUESTS;
      break;
  }

  res.locals.metrics.http.inc(method);

  next();
};

export const logHttpRequests = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const logger = res.locals.logger;

  const originalJson = res.json;
  const originalSend = res.send;
  const originalStatus = res.status;

  let status: number = 200;
  let response: any = null;

  res.json = (body: any) => {
    response = body;
    return originalJson.call(res, body);
  };

  res.send = (body: any) => {
    response = body;
    return originalSend.call(res, body);
  };

  res.status = (code: number) => {
    status = code;
    return originalStatus.call(res, code);
  };

  res.on("finish", () => {
    const log = {
      request: req.body,
      response,
      status,
      type: "http",
      auth: !!req.headers.authorization,
      method: req.method,
      path: req.path,
    } as const;

    if (Math.floor(status / 100) === 5) {
      res.locals.metrics.http.inc(HttpMetric.SERVER_ERROR);
      logger.error(log);
    } else {
      logger.info(log);
    }
  });

  next();
};
