import { NextFunction, Request, Response } from "express";
import { StatusCodeError } from "../endpointHelper";

export const checkChaos = (_req: Request, res: Response, next: NextFunction) => {
  if (res.locals.chaos && Math.random() < 0.5) {
    throw new StatusCodeError("Chaos monkey", 500);
  }

  next();
};
