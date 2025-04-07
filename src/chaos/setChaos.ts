import { Request, Response } from "express";
import { ChaosManager } from "./ChaosManager";
import { Role } from "../model";
import { StatusCodeError } from "../endpointHelper";

interface Options {
  param?: string;
  method?: string;
}

export const setChaos = (endpoint: string, options?: Options) => {
  let param: string, method: string | undefined;

  if (options) {
    param = options.param ?? "state";
    method = options.method;
  } else {
    param = "state";
    method = undefined;
  }

  return (req: Request, res: Response) => {
    if (!res.locals.user?.isRole(Role.ADMIN)) {
      throw new StatusCodeError("Unauthorized", 401);
    }

    const chaos = req.params[param] === "true";

    ChaosManager.getInstance().setChaos(endpoint, chaos, method);

    res.json({ chaos });
  };
};
