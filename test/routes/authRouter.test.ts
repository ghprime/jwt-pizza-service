import request from "supertest";
import { app } from "../../src";

describe("register", () => {
  test("random", async () => {
    request(app);
    expect(5).toBe(5);
  });
});
