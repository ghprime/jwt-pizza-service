import "express";
import type { UserData } from "../src/model";
import { DatabaseDAO } from "../src";
import { Context } from "../src/context";
import { Logger } from "../src/logger";

declare global {
  namespace Express {
    interface Locals {
      user: UserData;
      dao: DatabaseDAO;
      metrics: Awaited<ReturnType<Context["metrics"]>>;
      logger: Logger;
    }
  }
}
