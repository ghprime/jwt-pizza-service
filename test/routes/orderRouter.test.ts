import request from "supertest";
import { app, DinerOrder, Franchise, MenuItem, Role, Store, UserData } from "../../src";
import TestAgent from "supertest/lib/agent";
import { ContextFactory } from "../../src/context";
import { createContext, getRandomString, newUser } from "../testUtils";

describe("orderRouter", () => {
  let server: TestAgent;

  const apiAuthPath = "/api/auth";
  
  const apiPath = "/api/order";

  const logIn = async (req: Record<string, string>) => await server
    .put(apiAuthPath)
    .send(req)
    .set("Content-Type", "application/json");

  const getMenu = async () => await server
    .get(`${apiPath}/menu`);

  const addMenuItem = async (menuItem: MenuItem, token?: string) => {
    if (token) return await server
      .put(`${apiPath}/menu`)
      .send(menuItem)
      .set("authorization", `auth ${token}`);

    return await server
      .put(`${apiPath}/menu`)
      .send(menuItem);
  };

  const getOrders = async (token?: string, page?: number) => {
    if (token) return await server
      .get(apiPath)
      .query({ page })
      .set("authorization", `auth ${token}`);
    
    return await server
      .get(apiPath)
      .query({ page });
  };

  const createOrder = async (order?: DinerOrder, token?: string) => {
    if (token) return await server
      .post(apiPath)
      .send(order)
      .set("authorization", `auth ${token}`);
    
    return await server
      .post(apiPath)
      .send(order);
  };

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

    const menuItem1 = await dao.addMenuItem({ 
      title: "title1", 
      description: "description1", 
      image: "image1", 
      price: 1, 
    } as MenuItem);
      
    const menuItem2 = await dao.addMenuItem({ 
      title: "title2", 
      description: "description2", 
      image: "image2", 
      price: 2, 
    } as MenuItem);
  
    const menu = [menuItem1, menuItem2];

    const userDinerOrder = await dao.addDinerOrder(userData, {
      franchiseId: franchise.id,
      storeId: store1.id,
      dinerId: userId,
      items: [
        { menuId: menuItem1.id },
        { menuId: menuItem2.id },
      ],
    } as unknown as DinerOrder);

    const adminDinerOrder = await dao.addDinerOrder(adminData, {
      franchiseId: franchise.id,
      storeId: store2.id,
      dinerId: adminId,
      items: [
        { menuId: menuItem1.id },
        { menuId: menuItem2.id },
      ],
    } as unknown as DinerOrder);

    return {
      admin,
      user,
      adminToken,
      userToken,
      adminId,
      userId,
      franchise,
      stores,
      menu,
      userDinerOrder,
      adminDinerOrder,
      dao,
    } as const;
  };

  describe("getMenu", () => {
    beforeEach(async () => {
      ContextFactory.setContext(createContext());
      server = request(app);
    });

    it("gets the menu", async () => {
      const { menu } = await setup();

      const res = await getMenu();

      expect(res.body).toStrictEqual(menu);
    });
  });

  describe("addMenuItems", () => {
    beforeEach(async () => {
      ContextFactory.setContext(createContext());
      server = request(app);
    });

    it("adds a menu item", async () => {
      const { adminToken, menu } = await setup();

      const menuItem = { 
        title: "title1", 
        description: "description1", 
        image: "image1", 
        price: 1, 
      } as MenuItem;

      const res = await addMenuItem(menuItem, adminToken);

      expect(res.body).toStrictEqual([...menu, { ...menuItem, id: 3 }]);
    });

    it("doesn't allow non-admin to add a menu item", async () => {
      const { userToken } = await setup();

      const menuItem = { 
        title: "title1", 
        description: "description1", 
        image: "image1", 
        price: 1, 
      } as MenuItem;

      const res = await addMenuItem(menuItem, userToken);

      expect(res.body.message).toBe("unable to add menu item");
    });

    it("requires a token", async () => {
      const menuItem = { 
        title: "title1", 
        description: "description1", 
        image: "image1", 
        price: 1, 
      } as MenuItem;

      const res = await addMenuItem(menuItem);

      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("getOrders", () => {
    beforeEach(async () => {
      ContextFactory.setContext(createContext());
      server = request(app);
    });

    it("gets an admins orders", async () => {
      const { adminToken, adminId, franchise } = await setup();

      const res = await getOrders(adminToken);

      expect(res.body).toEqual(expect.objectContaining({
        dinerId: adminId,
        page: 1,
        orders: [{
          id: 2,
          date: expect.stringMatching(/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/),
          storeId: 2,
          franchiseId: franchise.id,
          items: [
            { 
              description: "description1",
              price: 1,
              id: 3,
              menuId: 1,
            },
            {
              description: "description2",
              price: 2,
              id: 4,
              menuId: 2,
            },
          ],
        }],
      }));
    });

    it("gets a users orders", async () => {
      const { userToken, userId, franchise } = await setup();

      const res = await getOrders(userToken);

      expect(res.body).toEqual(expect.objectContaining({
        dinerId: userId,
        page: 1,
        orders: [{
          franchiseId: franchise.id,
          id: 1,
          date: expect.stringMatching(/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/),
          storeId: 1,
          items: [
            { 
              description: "description1",
              price: 1,
              id: 1,
              menuId: 1,
            },
            {
              description: "description2",
              price: 2,
              id: 2,
              menuId: 2,
            },
          ],
        }],
      }));
    });

    it("gets a users other pages of orders", async () => {
      const { userToken, userId } = await setup();

      const res = await getOrders(userToken, 2);

      expect(res.body).toEqual(expect.objectContaining({
        dinerId: userId,
        page: 2,
        orders: [],
      }));
    });

    it("requires a token", async () => {
      const res = await getOrders();

      expect(res.body.message).toBe("unauthorized");
    });
  });

  describe("createOrder", () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(async () => {
      ContextFactory.setContext(createContext());
      server = request(app);
      
      fetchMock = jest.spyOn(global, "fetch");
    });

    it("creates an order", async () => {
      fetchMock.mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            reportUrl: "reportUrl",
            jwt: "jwt",
          }),
        }),
      );

      const { 
        userToken,
        franchise,
        stores,
        menu,
      } = await setup();

      const dinerOrder = {
        franchiseId: franchise.id,
        storeId: stores[0].id,
        items: [
          {
            menuId: menu[0].id,
          },
        ],
      } as DinerOrder;

      const res = await createOrder(dinerOrder, userToken);

      expect(res.body).toStrictEqual({
        order: { 
          ...dinerOrder,
          items: res.body.order.items,
          id: 3,
        },
        reportSlowPizzaToFactoryUrl: "reportUrl",
        jwt: "jwt",
      });
    });

    it("alerts if the order wasn't fulfilled", async () => {
      fetchMock.mockImplementation(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ 
            reportUrl: "reportUrl",
          }),
        }),
      );

      const { 
        userToken,
        franchise,
        stores,
        menu,
      } = await setup();

      const dinerOrder = {
        franchiseId: franchise.id,
        storeId: stores[0].id,
        items: [
          {
            menuId: menu[0].id,
          },
        ],
      } as DinerOrder;

      const res = await createOrder(dinerOrder, userToken);

      expect(res.body).toStrictEqual({
        message: "Failed to fulfill order at factory",
        reportPizzaCreationErrorToPizzaFactoryUrl: "reportUrl",
      });
    });

    it("requires a token", async () => {
      const dinerOrder = {
        franchiseId: 100,
        storeId: 100,
        items: [
          {
            menuId: 100,
          },
        ],
      } as DinerOrder;

      const res = await createOrder(dinerOrder);

      expect(res.body.message).toBe("unauthorized");
    });
  });
});
