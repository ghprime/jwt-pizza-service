import express, { NextFunction, Request, Response } from "express";
import version from "./version.json";
import config from "./config";
import {
  authRouter,
  authRouterEndpoints,
  franchiseRouter,
  franchiseRouterEndpoints,
  orderRouter,
  orderRouterEndpoints,
  setAuthUser,
} from "./routes/index";
import { StatusCodeError, setLocals, trackHttpMetrics } from "./endpointHelper";

export const app = express();
app.use(express.json());
app.use(setLocals);
app.use(trackHttpMetrics);
app.use(setAuthUser);
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

const apiRouter = express.Router();

app.use("/api", apiRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/order", orderRouter);
apiRouter.use("/franchise", franchiseRouter);

apiRouter.use("/docs", (_req, res) => {
  res.json({
    version: version.version,
    endpoints: [
      ...authRouterEndpoints,
      ...orderRouterEndpoints,
      ...franchiseRouterEndpoints,
    ],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get("/", (_req, res) => {
  res.json({
    message: "welcome to JWT Pizza",
    version: version.version,
  });
});

app.use("*", (_req, res) => {
  res.status(404).json({
    message: "unknown endpoint",
  });
});

// Default error handler for all exceptions and errors.
app.use(
  (err: StatusCodeError, _req: Request, res: Response, next: NextFunction) => {
    res
      .status(err.statusCode ?? 500)
      .json({ message: err.message });
    next();
  },
);
