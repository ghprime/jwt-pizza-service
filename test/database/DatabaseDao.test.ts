import { DatabaseDAO, DinerOrder, Franchise, MemoryDAO, MenuItem, MySqlDAO, Role, RoleData, StatusCodeError, Store, UserData } from "../../src";
import { exclude, getRandomString, newUser } from "../testUtils";
import { randomUUID } from "node:crypto";

describe("DatabaseDao", () => {
  const memDao = MemoryDAO.createInstance();
  const sqlDao = MySqlDAO.getInstance();

  const daos: [string, Promise<DatabaseDAO>][] = [
    ["memory", memDao],
    ["sql", sqlDao],
  ];

  const newDiner = () => newUserData([{ role: Role.DINER }]);
  const newFranchisee = (franchise: string) => newUserData([{ role: Role.FRANCHISEE, objectId: franchise }]);
  const newAdmin = () => newUserData([{ role: Role.ADMIN }]);

  const newUserData = (roles: RoleData[]) => ({
    ...newUser(),
    roles,
  } as UserData);

  for (const [type, pDao] of daos) {
    let dao: DatabaseDAO;

    beforeAll(async () => {
      dao = await pDao;
    });
    
    describe(`${type} dao tests`, () => {
      afterEach(async () => {
        await dao.clear();
      });

      describe("addUser", () => {
        it("adds a diner", async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          expect(userData).toEqual(expect.objectContaining({
            ...user,
            password: undefined,
            id: expect.any(Number),
          }));
        });

        it("adds an admin", async () => {
          const admin = newAdmin();

          const adminData = await dao.addUser(admin);
          
          expect(adminData).toEqual(expect.objectContaining({
            ...admin,
            password: undefined,
            id: expect.any(Number),
          }));
        });

        it("doesn't allow a franchisee without a franchise", async () => {
          const franchisee = newFranchisee("no such franchise");

          await expect(async () => await dao.addUser(franchisee)).rejects.toEqual(new Error("No ID found"));
        });
      });

      describe("getUser", () => {
        const admin = newAdmin();
        const diner = newDiner();

        it.each([
          ["an admin", admin],
          ["a diner", diner],
        ])("gets %s", async (_, user) => {
          const addedUser = await dao.addUser(user);

          const retrievedUser = await dao.getUser(user);

          expect(retrievedUser).toStrictEqual({
            ...addedUser,
            roles: addedUser.roles.map(role => {
              if (role.objectId) return {
                role: role.role,
                objectId: role.objectId,
              };
              return {
                role: role.role,
                objectId: undefined,
              };
            }),
          });
        });
        
        it.each([
          ["admin", admin],
          ["diner", diner],
        ])("cant get non-existant %s", async (_, user) => {
          await expect(async () => await dao.getUser(user))
            .rejects
            .toEqual(new StatusCodeError("unknown user", 404));
        });
      });

      describe("updateUser", () => {
        const admin = newAdmin();
        const diner = newDiner();

        it.each([
          ["admin", admin],
          ["diner", diner],
        ])("updates %s", async (_, user) => {
          const userData = await dao.addUser(user);

          const toUpdate = { ...newUser(), id: userData.id } as UserData;

          const updatedUser = await dao.updateUser(toUpdate);

          expect(updatedUser).toStrictEqual({ 
            ...toUpdate, 
            name: user.name, 
            password: undefined, 
            roles: user.roles.map(role => {
              if (role.objectId) return {
                role: role.role,
                objectId: role.objectId,
              };
              return {
                role: role.role,
                objectId: undefined,
              };
            }),
          });
        });
      });

      describe("loginUser", () => {
        const admin = newAdmin();
        const diner = newDiner();

        it.each([
          ["an admin", admin],
          ["a diner", diner],
        ])("logs in %s", async (_, user) => {
          const userData = await dao.addUser(user);

          const token = `not.this.${randomUUID()}`;

          await dao.loginUser(userData.id, token);
        });
      });

      describe("isLoggedIn", () => {
        const admin = newAdmin();
        const diner = newDiner();

        it.each([
          ["admin", admin],
          ["diner", diner],
        ])("asserts %s is logged in", async (_, user) => {
          const userData = await dao.addUser(user);

          const token = `not.this.${randomUUID()}`;

          await dao.loginUser(userData.id, token);

          const isLoggedIn = await dao.isLoggedIn(token);

          expect(isLoggedIn).toBe(true);
        });

        it("asserts user is not logged in", async () => {
          const token = `not.this.${randomUUID()}`;

          const isLoggedIn = await dao.isLoggedIn(token);

          expect(isLoggedIn).toBe(false);
        });
      });
      
      describe("logoutUser", () => {
        it("logs out a user", async () => {
          const diner = newDiner();
  
          const userData = await dao.addUser(diner);
  
          const token = `not.this.${randomUUID()}`;
  
          await dao.loginUser(userData.id, token);
          
          await dao.logoutUser(token);
  
          const isLoggedIn = await dao.isLoggedIn(token);
          
          expect(isLoggedIn).toBe(false);
        });
      });
  
      describe("createFranchise", () => {
        const setup = async () => {
          const user = newDiner();
  
          const userData = await dao.addUser(user);
  
          const userId = userData.id;
  
          const franchise = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;
  
          return {
            user,
            userId,
            franchise,
          };
        };
  
        it("creates a franchise", async () => {
          const { franchise, user, userId } = await setup();
  
          const createdFranchise = await dao.createFranchise(franchise);
  
          expect(createdFranchise).toEqual(expect.objectContaining({
            name: franchise.name,
            admins: [{
              name: user.name,
              email: user.email,
              id: userId,
              roles: franchise.admins[0].roles,
            }],
            id: expect.any(Number),
          }));
        });
        
        it("allows the creation of franchisees", async () => {
          const { franchise } = await setup();
  
          const createdFranchise = await dao.createFranchise(franchise);
  
          const franchisee = newFranchisee(createdFranchise.name);
  
          const createdFranchisee = await dao.addUser(franchisee);
  
          expect(createdFranchisee).toEqual(expect.objectContaining({
            name: franchisee.name,
            email: franchisee.email,
            password: undefined,
            id: expect.any(Number),
          }));
        });
  
        it("errors when an unknown user is admin", async () => {
          const { franchise } = await setup();
  
          franchise.admins[0].email = getRandomString();
  
          await expect(async () => await dao.createFranchise(franchise)).rejects.toEqual(new Error(`unknown user for franchise admin ${franchise.admins[0].email} provided`));
        });
      });
  
      describe("deleteFranchise", () => {
        const setup = async () => {
          const user = newDiner();
  
          const userData = await dao.addUser(user);
  
          const userId = userData.id;
  
          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;
  
          const franchise = await dao.createFranchise(franchiseToCreate);
  
          return {
            user,
            userId,
            franchise,
          };
        };
  
        it("deletes a franchise", async () => {
          const { franchise } = await setup();
  
          await dao.deleteFranchise(franchise.id);
        });
  
        it("deletes non-existant franchise", async () => {
          await dao.deleteFranchise(-1);
        });
      });

      describe("getFranchises", () => {
        const setup = async () => {
          const user = newDiner();
  
          const userData = await dao.addUser(user);
  
          const userId = userData.id;
  
          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;
  
          const franchise = await dao.createFranchise(franchiseToCreate);
  
          const rawStore = {
            name: getRandomString(),
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 1,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);

          const rawOrder = {
            items: [{
              menuId: menuItem.id,
            }],
            dinerId: userId,
            franchiseId: franchise.id,
            storeId: store.id,
          } as DinerOrder;

          const order = await dao.addDinerOrder(userData, rawOrder);

          return {
            user,
            userId,
            franchise,
            store,
            menuItem,
            order,
          };
        };

        it("gets franchises with stores", async () => {
          const { franchise, store } = await setup();

          const franchises = await dao.getFranchises();

          expect(franchises).toStrictEqual([{
            id: franchise.id,
            stores: [exclude(store, ["franchiseId"])],
            name: franchise.name,
          }]);
        });

        it("gets more franchise info as admin", async () => {
          const { franchise, store, user, userId } = await setup();

          const admin = newAdmin();

          const adminData = await dao.addUser(admin);

          const franchises = await dao.getFranchises({ 
            ...adminData,
            isRole: () => true,
          });

          expect(franchises).toStrictEqual([{
            id: franchise.id,
            name: franchise.name,
            stores: [{
              ...exclude(store, ["franchiseId"]),
              totalRevenue: 1,
            }],
            admins: [{
              email: user.email,
              id: userId,
              name: user.name,
            }],
          }]);
        });
      });

      describe("getUserFranchises", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          const rawStore = {
            name: getRandomString(),
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 1,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);

          const rawOrder = {
            items: [{
              menuId: menuItem.id,
            }],
            dinerId: userId,
            franchiseId: franchise.id,
            storeId: store.id,
          } as DinerOrder;

          const order = await dao.addDinerOrder(userData, rawOrder);

          return {
            user,
            userId,
            franchise,
            store,
            menuItem,
            order,
          };
        };

        it("gets a user's franchises", async () => {
          const { userId, user, franchise, store } = await setup();

          const franchises = await dao.getUserFranchises(userId);

          expect(franchises).toStrictEqual([{
            admins: [{
              email: user.email,
              id: userId,
              name: user.name,
            }],
            id: franchise.id,
            name: franchise.name,
            stores: [{
              id: store.id,
              name: store.name,
              totalRevenue: 1,
            }],
          } as Franchise]);
        });

        it("doesn't get another user's franchises", async () => {
          await setup();

          const diner = newDiner();

          const dinerData = await dao.addUser(diner);

          const franchises = await dao.getUserFranchises(dinerData.id);

          expect(franchises).toStrictEqual([]);
        });
      });

      describe("getFranchise", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          const rawStore = {
            name: getRandomString(),
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 1,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);

          const rawOrder = {
            items: [{
              menuId: menuItem.id,
            }],
            dinerId: userId,
            franchiseId: franchise.id,
            storeId: store.id,
          } as DinerOrder;

          const order = await dao.addDinerOrder(userData, rawOrder);

          return {
            user,
            userId,
            franchise,
            store,
            menuItem,
            order,
          };
        };

        it("gets a franchise", async () => {
          const { franchise, user, userId, store } = await setup();

          const retrievedFranchise = await dao.getFranchise(franchise);

          expect(retrievedFranchise).toStrictEqual({
            admins: [{
              email: user.email,
              id: userId,
              name: user.name,
            }],
            id: franchise.id,
            name: franchise.name,
            stores: [{
              id: store.id,
              name: store.name,
              totalRevenue: 1,
            }],
          });
        });
      });

      describe("createStore", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          return {
            user,
            userId,
            franchise,
          };
        };

        it("creates a store", async () => {
          const { franchise } = await setup();

          const rawStore = {
            name: getRandomString(),
            franchiseId: franchise.id,
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          expect(store).toEqual(expect.objectContaining({
            id: expect.any(Number),
            franchiseId: franchise.id,
            name: rawStore.name,
          }));
        });

        it("can create two duplicate stores", async () => {
          const { franchise } = await setup();

          const rawStore = {
            name: getRandomString(),
            franchiseId: franchise.id,
          } as Store;

          const store1 = await dao.createStore(franchise.id, rawStore);
          const store2 = await dao.createStore(franchise.id, rawStore);

          expect(store1).toEqual(expect.objectContaining({
            id: expect.any(Number),
            franchiseId: franchise.id,
            name: rawStore.name,
          }));

          expect(store2).toEqual(expect.objectContaining({
            id: expect.any(Number),
            franchiseId: franchise.id,
            name: rawStore.name,
          }));
        });
      });

      describe("deleteStore", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          const rawStore = {
            name: getRandomString(),
            franchiseId: franchise.id,
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          return {
            user,
            userId,
            franchise,
            store,
          };
        };

        it("deletes a store", async () => {
          const { franchise, store } = await setup();

          await dao.deleteStore(franchise.id, store.id);
        });
      });

      describe("addMenuItem", () => {
        it("adds a menu item", async () => {
          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: Math.random() * 30,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);

          expect(menuItem).toEqual(expect.objectContaining({
            ...rawMenuItem,
            id: expect.any(Number),
          }));
        });

        it("can have duplicate menu items", async () => {
          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: Math.random() * 30,
          } as MenuItem;

          const menuItem1 = await dao.addMenuItem(rawMenuItem);

          expect(menuItem1).toEqual(expect.objectContaining({
            ...rawMenuItem,
            id: expect.any(Number),
          }));

          const menuItem2 = await dao.addMenuItem(rawMenuItem);

          expect(menuItem2).toEqual(expect.objectContaining({
            ...rawMenuItem,
            id: expect.any(Number),
          }));
        });
      });

      describe("getMenu", () => {
        const setup = async () => {
          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 2,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);
          
          return {
            menuItem,
          };
        };

        it("gets the menu", async () => {
          const { menuItem } = await setup();

          const menu = await dao.getMenu();

          expect(menu).toStrictEqual([menuItem]);
        });
      });

      describe("addDinerOrder", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          const rawStore = {
            name: getRandomString(),
            franchiseId: franchise.id,
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 2,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);
          
          return {
            user,
            userId,
            franchise,
            store,
            menuItem,
          };
        };

        it("adds a diner order", async () => {
          const { userId, franchise, store, menuItem } = await setup();

          const rawOrder = {
            franchiseId: franchise.id,
            storeId: store.id,
            items: [{
              menuId: menuItem.id,
            }],
          } as DinerOrder;

          const order = await dao.addDinerOrder({ id: userId } as UserData, rawOrder);

          expect(order).toEqual(expect.objectContaining({
            ...order,
            id: expect.any(Number),
          }));
        });

        it("doesn't allow the user to choose the price", async () => {
          const { userId, franchise, store, menuItem } = await setup();

          const rawOrder = {
            franchiseId: franchise.id,
            storeId: store.id,
            items: [{
              menuId: menuItem.id,
              price: 0,
            }],
          } as DinerOrder;

          await dao.addDinerOrder({ id: userId } as UserData, rawOrder);

          const franchiseDetails = await dao.getFranchise(franchise);

          expect(franchiseDetails.stores[0].totalRevenue).toBe(menuItem.price);
        });
      });

      describe("getOrders", () => {
        const setup = async () => {
          const user = newDiner();

          const userData = await dao.addUser(user);

          const userId = userData.id;

          const franchiseToCreate = {
            admins: [{ email: user.email }],
            name: getRandomString(),
          } as Franchise;

          const franchise = await dao.createFranchise(franchiseToCreate);

          const rawStore = {
            name: getRandomString(),
            franchiseId: franchise.id,
          } as Store;

          const store = await dao.createStore(franchise.id, rawStore);

          const rawMenuItem = {
            title: getRandomString(),
            description: getRandomString(),
            image: getRandomString(),
            price: 2,
          } as MenuItem;

          const menuItem = await dao.addMenuItem(rawMenuItem);
          
          return {
            user,
            userId,
            franchise,
            store,
            menuItem,
          };
        };

        it("gets a user's orders", async () => {
          const { userId, franchise, store, menuItem } = await setup();

          const rawOrder = {
            franchiseId: franchise.id,
            storeId: store.id,
            items: [{
              menuId: menuItem.id,
            }],
          } as DinerOrder;

          const order = await dao.addDinerOrder({ id: userId } as UserData, rawOrder);

          const orders = await dao.getOrders({ id: userId } as UserData);

          expect(orders).toEqual(expect.objectContaining({
            dinerId: userId,
            orders: [{
              date: orders.orders[0].date,
              franchiseId: franchise.id,
              id: order.id,
              items: [{
                description: menuItem.description,
                id: order.id,
                menuId: menuItem.id,
                price: menuItem.price,
              }],
              storeId: store.id,
            }],
            page: 1,
          }));
        });
      });
    });
  }
});
