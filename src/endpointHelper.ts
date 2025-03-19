import { NextFunction, Request, Response } from "express";
import { ContextFactory } from "./context";
import { HttpMetric, LatencyMetric } from "./metrics";

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

export const setLocals = asyncHandler(async (_req, res, next) => {
  const dao = await ContextFactory.context().dao();
  const metrics = await ContextFactory.context().metrics();
  res.locals.dao = dao;
  res.locals.metrics = metrics;
  next();
});

export const trackHttpMetrics = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    res
      .locals
      .metrics
      .latency
      .add(LatencyMetric.SERVICE_ENDPOINT, Date.now() - start);
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
