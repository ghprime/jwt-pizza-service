import "express";
import type { UserData } from "../src/model";
import { DatabaseDAO } from "../src";

declare global {
  namespace Express {
    interface Locals {
      user: UserData;
      dao: DatabaseDAO;
    }
  }
}
