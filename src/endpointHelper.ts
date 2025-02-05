import { NextFunction, Request, Response } from "express";
import { ContextFactory } from "./context";

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

export const setDbDAO = asyncHandler(async (_req, res, next) => {
  const dao = await ContextFactory.context().dao();
  res.locals.dao = dao;
  next();
});
