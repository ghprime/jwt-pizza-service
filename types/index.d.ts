import "express";
import type { UserData } from "../src/model";

declare global {
  namespace Express {
    interface Locals {
      user: UserData;
    }
  }
}
