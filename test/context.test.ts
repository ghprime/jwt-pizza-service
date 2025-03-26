import { DatabaseDAO, MySqlDAO } from "../src";
import { Context, ContextFactory } from "../src/context";
import { Logger } from "../src/logger";


describe("context", () => {
  beforeEach(() => {
    ContextFactory["_context"] = undefined;
  });

  it("has a default (MySqlDAO) context", async () => {
    const context = ContextFactory.context();

    const dao = await context.dao();

    expect(dao).toBe(await MySqlDAO.getInstance());
  });

  it("can set context", async () => {
    const context = {
      async dao() { 
        return undefined as unknown as DatabaseDAO; 
      },
      async metrics() {
        return undefined as unknown as ReturnType<Context["metrics"]>;
      },
      async logging() {
        return undefined as unknown as Logger;
      },
    };

    ContextFactory.setContext(context);

    expect(ContextFactory["_context"]).toBe(context);
  });

  it("can reset contexts", async () => {
    const context = {
      async dao() { 
        return undefined as unknown as DatabaseDAO; 
      },
      async metrics() {
        return undefined as unknown as ReturnType<Context["metrics"]>;
      },
      async logging() {
        return undefined as unknown as Logger;
      },
    };
    
    ContextFactory["_context"] = context;
    
    ContextFactory.resetContext();

    expect(ContextFactory["_context"]).not.toBe(context);
  });
});
