import request from "supertest";
import { app } from "../src";
import TestAgent from "supertest/lib/agent";
import { ContextFactory } from "../src/context";
import { createContext } from "./testUtils";
import version from "../src/version.json";
import { authRouterEndpoints, franchiseRouterEndpoints, orderRouterEndpoints } from "../src";
import config from "../src/config";

describe("service", () => {
  let server: TestAgent;

  const apiPath = "/api";

  beforeEach(async () => {
    ContextFactory.setContext(createContext());
    server = request(app);
  });

  it("can get the docs", async () => {
    const res = await server.get(`${apiPath}/docs`);

    expect(res.body).toStrictEqual({
      version: version.version,
      endpoints: [
        ...authRouterEndpoints,
        ...orderRouterEndpoints,
        ...franchiseRouterEndpoints,
      ],
      config: { factory: config.factory.url, db: config.db.connection.host },
    });
  });

  it("can get the welcome", async () => {
    const res = await server.get("/");

    expect(res.body).toStrictEqual({
      message: "welcome to JWT Pizza",
      version: version.version,
    });
  });

  it("gets the 404 page", async () => {
    const res = await server.get("/not/a/path");

    expect(res.body).toStrictEqual({
      message: "unknown endpoint",
    });
  });
});
