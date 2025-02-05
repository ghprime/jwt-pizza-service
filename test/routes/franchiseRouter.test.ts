import request from "supertest";
import { app, Franchise, Role, Store, UserData } from "../../src";
import TestAgent from "supertest/lib/agent";
import { ContextFactory } from "../../src/context";
import { createContext, exclude, getRandomString, newUser } from "../testUtils";


describe("franchiseRouter", () => {
  let server: TestAgent;

  const apiFranchisePath = "/api/franchise";
  const apiAuthPath = "/api/auth";
  
  const logIn = async (req: Record<string, string>) => await server
    .put(apiAuthPath)
    .send(req)
    .set("Content-Type", "application/json");

  const getFranchises = async (token?: string) => {
    if (token) return await server
      .get(apiFranchisePath)
      .set("authorization", `auth ${token}`);

    return await server
      .get(apiFranchisePath);
  };

  const getUserFranchises = async (userId: number, token?: string) => {
    if (token) return await server
      .get(`${apiFranchisePath}/${userId}`)
      .set("authorization", `auth ${token}`);

    return await server
      .get(`${apiFranchisePath}/${userId}`);
  };

  const createFranchise = async (franchise?: Partial<Franchise>, token?: string) => {
    if (token) return await server
      .post(apiFranchisePath)
      .send(franchise)
      .set("authorization", `auth ${token}`);

    return await server
      .post(apiFranchisePath)
      .send(franchise);
  };

  const deleteFranchise = async (franchiseId?: number, token?: string) => {
    if (token) return await server
      .delete(`${apiFranchisePath}/${franchiseId}`)
      .set("authorization", `auth ${token}`);

    return await server
      .delete(`${apiFranchisePath}/${franchiseId}`);
  };

  const createStore = async (franchiseId?: number, store?: Partial<Store>, token?: string) => {
    if (token) return await server
      .post(`${apiFranchisePath}/${franchiseId}/store`)
      .send(store)
      .set("authorization", `auth ${token}`);

    return await server
      .post(`${apiFranchisePath}/${franchiseId}/store`)
      .send(store);
  };

  const deleteStore = async (franchiseId?: number, storeId?: number, token?: string) => {
    if (token) return await server
      .delete(`${apiFranchisePath}/${franchiseId}/store/${storeId}`)
      .set("authorization", `auth ${token}`);

    return await server
      .delete(`${apiFranchisePath}/${franchiseId}/store/${storeId}`);
  };

  beforeEach(async () => {
    ContextFactory.setContext(createContext());
    server = request(app);
  });

  const setup = async () => {
    const admin = newUser();
    const user = newUser();

    const dao = await ContextFactory.context().dao();

    const adminData = await dao.addUser({ ...admin, roles: [{ role: Role.ADMIN }]} as UserData);
    const userData = await dao.addUser({ ...user, roles: [{ role: Role.DINER }]} as UserData);

    const res1 = await logIn(admin);

    const adminToken: string = res1.body.token;

    const res2 = await logIn(user);

    const userToken: string = res2.body.token;

    const adminId = adminData.id;

    const userId = userData.id;

    const franchise = await dao.createFranchise({ name: getRandomString(), admins: [{ email: user.email }] } as Franchise);

    const store1 = await dao.createStore(franchise.id, { name: getRandomString() } as Store);

    const store2 = await dao.createStore(franchise.id, { name: getRandomString() } as Store);
    
    const stores = [store1, store2];

    return {
      admin,
      user,
      adminToken,
      userToken,
      adminId,
      userId,
      franchise,
      stores,
    } as const;
  };
  
  describe("getFranchises", () => {
    it("allows admin to get all franchises and admins, and total revenue", async () => {
      const { 
        user, 
        adminToken, 
        userId,
        franchise,
        stores,
      } = await setup();

      const res = await getFranchises(adminToken);

      expect(res.body).toStrictEqual([{ 
        stores: stores.map(store => exclude({ ...store, totalRevenue: 0 }, ["franchiseId"])),
        id: franchise.id, 
        name: franchise.name, 
        admins: [{ 
          name: user.name, 
          email: user.email, 
          id: userId,
        }], 
      }]);
    });

    it("allows user to get all franchises, no admins", async () => {
      const {
        franchise,
        stores,
        userToken,
      } = await setup();
      const res = await getFranchises(userToken);

      expect(res.body).toStrictEqual([{ stores: stores.map(store => exclude(store, ["franchiseId"])), id: franchise.id, name: franchise.name }]);
    });

    it("doesn't require a token", async () => {
      const {
        franchise,
        stores,
      } = await setup();
      const res = await getFranchises();

      expect(res.body).toStrictEqual([{ stores: stores.map(store => exclude(store, ["franchiseId"])), id: franchise.id, name: franchise.name }]);
    });
  });

  describe("getUserFranchises", () => {
    it("retrieves user franchises", async () => {
      const { userId, userToken, user, franchise, stores } = await setup();

      const res = await getUserFranchises(userId, userToken);

      expect(res.body).toStrictEqual([{
        admins: [{
          email: user.email,
          id: userId,
          name: user.name,
        }],
        id: franchise.id,
        name: franchise.name,
        stores: stores.map(store => exclude({ ...store, totalRevenue: 0 }, ["franchiseId"])),
      }]);
    });

    it("retrieves empty list for user without franchises", async () => {
      const { adminId, adminToken } = await setup();

      const res = await getUserFranchises(adminId, adminToken);

      expect(res.body).toStrictEqual([]);
    });

    it("allows admin to get other user's frachises", async () => {
      const { userId, adminToken, user, franchise, stores } = await setup();

      const res = await getUserFranchises(userId, adminToken);

      expect(res.body).toStrictEqual([{
        admins: [{
          email: user.email,
          id: userId,
          name: user.name,
        }],
        id: franchise.id,
        name: franchise.name,
        stores: stores.map(store => exclude({ ...store, totalRevenue: 0 }, ["franchiseId"])),
      }]);
    });

    it("requires a token", async () => {
      const { userId } = await setup();

      const res = await getUserFranchises(userId, undefined);

      expect(res.body.message).toBe("unauthorized");
    });

    it("doesn't error out with invalid userId", async () => {
      const { userToken } = await setup();

      const res = await getUserFranchises(-1, userToken);

      expect(res.body).toStrictEqual([]);
    });
  });

  describe("createFranchise", () => {
    it("allows admins to create a franchise", async () => {
      const { adminToken, user, userId } = await setup();
      
      const franchiseToCreate = { name: getRandomString(), admins: [{ email: user.email }] } as Franchise;

      const res = await createFranchise(franchiseToCreate, adminToken);

      expect(res.body).toStrictEqual({
        admins: [{
          ...exclude(user, ["password"]),
          id: userId,
        }],
        id: 2,
        name: franchiseToCreate.name,
      });
    });

    it("doesn't allow non-admins to create a franchise", async () => {
      const { userToken, user } = await setup();
      
      const franchiseToCreate = { name: getRandomString(), admins: [{ email: user.email }] } as Franchise;

      const res = await createFranchise(franchiseToCreate, userToken);

      expect(res.body.message).toBe("unable to create a franchise");
    });

    it("requires a token", async () => {
      const franchiseToCreate = { name: getRandomString(), admins: [{ email: getRandomString() }] } as Franchise;

      const res = await createFranchise(franchiseToCreate, undefined);

      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("deleteFranchise", () => {
    it("allows admin to delete a franchise", async () => {
      const { adminToken, franchise } = await setup();

      const res = await deleteFranchise(franchise.id, adminToken);

      expect(res.body.message).toBe("franchise deleted");
    });

    it("doens't allow non-admins to delete a franchise", async () => {
      const { userToken, franchise } = await setup();

      const res = await deleteFranchise(franchise.id, userToken);

      expect(res.body.message).toBe("unable to delete a franchise");
    });

    it("requries a token", async () => {
      const res = await deleteFranchise(0, undefined);

      expect(res.body.message).toBe("unauthorized");
    });

    it("allows a non-existant franchise to be deleted by admin", async () => {
      const { adminToken } = await setup();

      const res = await deleteFranchise(1000001, adminToken);

      expect(res.body.message).toBe("franchise deleted");
    });
  });

  describe("createStore", () => {
    it("allows admin to create a store", async () => {
      const { franchise, adminToken } = await setup();

      const storeToCreate = { name: getRandomString() } as Store;

      const res = await createStore(franchise.id, storeToCreate, adminToken);

      expect(res.body).toStrictEqual({
        franchiseId: franchise.id,
        name: storeToCreate.name,
        id: 3,
      });
    });

    it("doesn't allow creation of a store on a non-existant franchise", async () => {
      const { adminToken } = await setup();

      const storeToCreate = { name: getRandomString() } as Store;

      const res = await createStore(100001, storeToCreate, adminToken);

      expect(res.body.message).toBe("unable to create a store");
    });

    it("allows franchise owner to create a store", async () => {
      const { franchise, userToken } = await setup();

      const storeToCreate = { name: getRandomString() } as Store;

      const res = await createStore(franchise.id, storeToCreate, userToken);

      expect(res.body).toStrictEqual({
        franchiseId: franchise.id,
        name: storeToCreate.name,
        id: 3,
      });
    });

    it("doesn't allow non-franchise owner to create a store", async () => {
      const { franchise } = await setup();

      const user = newUser();

      const dao = await ContextFactory.context().dao();

      await dao.addUser({ ...user, roles: [{ role: Role.DINER }] } as UserData);

      const res1 = await logIn(user);

      const userToken = res1.body.token;

      const storeToCreate = { name: getRandomString() } as Store;

      const res2 = await createStore(franchise.id, storeToCreate, userToken);

      expect(res2.body.message).toBe("unable to create a store");
    });

    it("requires a token", async () => {
      const storeToCreate = { name: getRandomString() } as Store;

      const res = await createStore(0, storeToCreate);

      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("deleteStore", () => {
    it("allows admin to delete store", async () => {
      const { franchise, adminToken } = await setup();

      const storeToCreate = { name: getRandomString() } as Store;

      const res = await createStore(franchise.id, storeToCreate, adminToken);

      expect(res.body).toStrictEqual({
        franchiseId: franchise.id,
        name: storeToCreate.name,
        id: 3,
      });
    });

    it("allows franchise owner to delete store", async () => {
      const { franchise, userToken, stores } = await setup();

      const storeId = stores[1].id;

      const res = await deleteStore(franchise.id, storeId, userToken);

      expect(res.body.message).toBe("store deleted");
    });

    it("doesn't allow non-franchise owner to delete store", async () => {
      const { franchise, stores } = await setup();

      const storeId = stores[1].id;

      const user = newUser();

      const dao = await ContextFactory.context().dao();

      await dao.addUser({ ...user, roles: [{ role: Role.DINER }] } as UserData);

      const res1 = await logIn(user);

      const userToken = res1.body.token;

      const res = await deleteStore(franchise.id, storeId, userToken);

      expect(res.body.message).toBe("unable to delete a store");
    });

    it("requires a token", async () => {
      const res = await deleteStore(0, 0);

      expect(res.body.message).toBe("unauthorized");
    });
  });
});
