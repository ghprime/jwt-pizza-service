import request from "supertest";
import { app, MySqlDAO, Role, UserData } from "../../src";
import TestAgent from "supertest/lib/agent";
import * as crypto from "node:crypto";

describe("authRouter", () => {
  let server: TestAgent;
  let req: Record<string, string>;

  const apiPath = "/api/auth";

  const getRandomString = () => {
    return crypto.randomBytes(20).toString("hex");
  };

  const newUser = () => ({
    password: getRandomString(),
    name: getRandomString(),
    email: `${getRandomString()}@email.com`,
  });

  const register = async (req: Record<string, string>) => await server
    .post(apiPath)
    .send(req)
    .set("Content-Type", "application/json");
  
  const logIn = async (req: Record<string, string>) => await server
    .put(apiPath)
    .send(req)
    .set("Content-Type", "application/json");

  const logout = async (token: string) => await server
    .delete(apiPath)
    .set("authorization", `auth ${token}`);
  
  const updateUser = async (req: Record<string, string>, userId: number, token: string) => await server
    .put(`${apiPath}/${userId}`)
    .send(req)
    .set("Content-Type", "application/json")
    .set("authorization", `auth ${token}`);
  
  beforeAll(() => {
    server = request(app);
  });

  afterEach(async () => {
    const dao = await MySqlDAO.getInstance();

    await dao.clear();
  });

  describe("register", () => {
    beforeEach(() => {
      req = newUser();
    });
  
    it("registers successfully", async () => {
      const res = await register(req);
  
      expect(res.body.message).toBe(undefined);
      expect(res.body.user).not.toBe(undefined);
      expect(res.body.user.roles).toStrictEqual([{
        role: Role.DINER,
      }]);
      expect(res.body.token).not.toBe(undefined);
    });
  
    it.each([
      "password",
      "email",
      "name",
    ])("errors when missing %s", async (toDelete: string) => {
      delete req[toDelete];
  
      const res = await register(req);
  
      expect(res.body.message).toBe("name, email, and password are required");
      expect(res.body.token).toBe(undefined);
    });
    
    it("allows extra fields", async () => {
      req.random = "hello!";
  
      const res = await register(req);
      
      expect(res.body.message).toBe(undefined);
      expect(res.body.user).not.toBe(undefined);
      expect(res.body.user.roles).toStrictEqual([{
        role: Role.DINER,
      }]);
      expect(res.body.token).not.toBe(undefined);
    });
    
    it("allows two duplicate users", async () => {
      req.random = "hello!";
  
      const res = await register(req);
      const res2 = await register(req);
      
      expect(res.body.message).toBe(undefined);
      expect(res.body.user).not.toBe(undefined);
      expect(res.body.user.roles).toStrictEqual([{
        role: Role.DINER,
      }]);
      expect(res.body.token).not.toBe(undefined);
      
      expect(res2.body.message).toBe(undefined);
      expect(res2.body.user).not.toBe(undefined);
      expect(res2.body.user.roles).toStrictEqual([{
        role: Role.DINER,
      }]);
      expect(res2.body.token).not.toBe(undefined);
  
      expect(res2.body).not.toStrictEqual(res.body);
      expect(res2.body.token).not.toBe(res.body.token);
      expect(res2.body.user.id).not.toBe(res.body.user.id);
    });
  });

  describe("login", () => {
    let user: Record<string, string>;

    beforeEach(() => {
      user = newUser();
    });

    it("successfully logs in", async () => {
      await register(user);

      const res = await logIn(user);

      expect(res.body.token).not.toBe(undefined);
    });

    it("can't log in a non-existant user", async () => {
      const res = await logIn(user);

      expect(res.body.token).toBe(undefined);
      expect(res.body.message).toBe("unknown user");
    });
  });

  describe("logout", () => {
    let user: Record<string, string>;

    beforeEach(() => {
      user = newUser();
    });

    it("successfully logs out", async () => {
      await register(user);

      const res1 = await logIn(user);
      
      const token: string = res1.body.token;
      
      const res2 = await logout(token);

      expect(res2.body.message).toBe("logout successful");
    });

    it("can't logout without token", async () => {
      const res = await server.delete(apiPath);

      expect(res.body.message).toBe("unauthorized");
    });

    it.each([
      undefined,
      "",
      getRandomString(),
    ])("can't logout with token '%s'", async (token) => {
      const res = await logout(token as string);

      expect(res.body.message).toBe("unauthorized");
    });

    it("can't double log out", async () => {
      await register(user);

      const res1 = await logIn(user);
      
      const token: string = res1.body.token;
      
      await logout(token);
      
      const res2 = await logout(token);

      expect(res2.body.message).toBe("unauthorized");
    });
  });

  describe("updateUser", () => {
    let adminCreds: Record<string, string>;
    let admin: UserData;
    let adminToken: string;
    let adminId: number;
    let user: Record<string, string>;
    let userToken: string;
    let userId: number;

    beforeEach(async () => {
      const dao = await MySqlDAO.getInstance();
      
      adminCreds = newUser();

      admin = await dao.addUser({ ...adminCreds, roles: [{ role: Role.ADMIN }] } as UserData);
      admin.password = adminCreds.password;
      const res1 = await logIn(adminCreds);

      adminToken = res1.body.token;
      
      adminId = res1.body.user.id;

      user = newUser();

      const res2 = await register(user);

      userToken = res2.body.token;
      userId = res2.body.user.id;
    });

    it("allows admin to update other user", async () => {
      const updatedUser = newUser();

      const res2 = await updateUser(updatedUser, userId, adminToken);

      expect(res2.body.name).toBe(user.name);
      expect(res2.body.email).toBe(updatedUser.email);
      expect(res2.body.id).toBe(userId);
    });

    it("allows admin to update self", async () => {
      const updatedUser = newUser();

      const res2 = await updateUser(updatedUser, adminId, adminToken);

      expect(res2.body.name).toBe(admin.name);
      expect(res2.body.email).toBe(updatedUser.email);
      expect(res2.body.id).toBe(adminId);

      await updateUser(adminCreds, adminId, adminToken);
    });

    it("allows user to update self", async () => {
      const updatedUser = newUser();

      const res = await updateUser(updatedUser, userId, userToken);

      expect(res.body.name).toBe(user.name);
      expect(res.body.email).toBe(updatedUser.email);
      expect(res.body.id).toBe(userId);
    });

    it("prevents non-admin user from updating other user", async () => {
      const otherUser = newUser();

      const res = await register(otherUser);

      const otherToken = res.body.token;

      const updatedUser = newUser();

      const res2 = await updateUser(updatedUser, userId, otherToken);

      expect(res2.body.message).toBe("unauthorized");
    });

    it("can't modify user without token", async () => {
      const updatedUser = newUser();

      const res2 = await updateUser(updatedUser, userId, "non-token");

      expect(res2.body.message).toBe("unauthorized");
    });
  });
});
