import { compare, hash } from "bcrypt";
import { UserData, Order, Franchise, Store, Role, RoleData, MenuItem, DinerOrder, OrderItem } from "../model";
import { DatabaseDAO } from "./DatabaseDAO";
import { StatusCodeError } from "../endpointHelper";
import config from "../config";

export class MemoryDAO implements DatabaseDAO {
  private users: UserData[] = [];
  private userId = 0;

  private roles: RoleData[] = [];

  private franchises: Franchise[] = [];
  private franchiseId = 0;

  private auth: Record<string, number> = {};

  private stores: Store[] = [];
  private storeId = 0;

  private menuItems: MenuItem[] = [];
  private menuItemId = 0;

  private dinerOrders: DinerOrder[] = [];
  private dinerOrderId = 0;

  private orderItems: OrderItem[] = [];
  private orderItemId = 0;

  private initialized: Promise<any>;

  static async createInstance(): Promise<DatabaseDAO> {
    const temp = new MemoryDAO();
    
    await temp.initialized;

    return temp;
  }

  private constructor() {
    this.initialized = this.initialize();
  }

  private async initialize() {
    const defaultAdmin = {
      name: "常用名字",
      email: "a@jwt.com",
      password: "admin",
      roles: [{ role: Role.ADMIN }],
    } as UserData;
    await this.addUser(defaultAdmin);
  }

  async getMenu(): Promise<MenuItem[]> {
    return this.menuItems;
  }

  async addMenuItem(item: MenuItem): Promise<MenuItem> {
    this.menuItems.push(item);

    item.id = ++this.menuItemId;

    return item;
  }

  async addUser(user: UserData): Promise<UserData> {
    user = { ...user };
    const hashedPassword = await hash(user.password!, 10);
    user.password = hashedPassword;
    this.users.push(user);
    user.id = ++this.userId;

    for (const role of user.roles) {
      switch (role.role) {
        case Role.FRANCHISEE: {
          const franchise = this.franchises.find(franchise => franchise.name === role.object);
          
          if (!franchise) throw new Error("No ID found");

          const franchiseId = franchise.id;

          this.roles.push({
            userId: user.id,
            role: role.role,
            objectId: franchiseId,
          });
          break;
        }
        default: {
          this.roles.push({
            userId: user.id,
            role: role.role,
            objectId: 0,
          });
        }
      }
    }

    return { ...user, password: undefined };
  }

  async getUser(providedUser: UserData): Promise<UserData> {
    await this.initialized;
    const user = this.users.find(user => user.email === providedUser.email);

    if (!user || !providedUser.password || !(await compare(providedUser.password!, user.password!))) {
      throw new StatusCodeError("unknown user", 404);
    }

    const roleResult = this.roles.filter(role => role.userId === user.id);

    const roles = roleResult.map(role => {
      return { objectId: role.objectId || undefined, role: role.role };
    });

    return { ...user, roles: roles, password: undefined };
  }

  async updateUser(updatedUser: UserData): Promise<UserData> {
    const user = this.users.find(user => user.id === updatedUser.id);

    if (!user) throw new StatusCodeError("unknown user", 400);

    if (updatedUser.email) user.email = updatedUser.email;

    if (updatedUser.password) user.password = await hash(updatedUser.password, 10);

    return this.getUser(updatedUser);
  }

  async loginUser(userId: number, token: string): Promise<void> {
    token = this.getTokenSignature(token);
    this.auth[token] = userId;
  }

  async isLoggedIn(token: string): Promise<boolean> {
    token = this.getTokenSignature(token);
    return !!this.auth[token];
  }

  async logoutUser(token: string): Promise<void> {
    token = this.getTokenSignature(token);
    if (this.auth[token]) delete this.auth[token];
    else throw new Error("Cannot logout if not logged in");
  }

  async getOrders(user: UserData, page = 1): Promise<Order> {
    const offset = this.getOffset(config.db.listPerPage, page);
    const orders: Partial<DinerOrder>[] = this.dinerOrders
      .filter(dinerOrder => dinerOrder.dinerId === user.id)
      .map(dinerOrder => ({ 
        id: dinerOrder.id, 
        storeId: dinerOrder.storeId, 
        date: dinerOrder.date, 
        franchiseId: dinerOrder.franchiseId,
      })).slice(offset, offset + config.db.listPerPage);
      
    for (const order of orders) {
      order.items = this.orderItems
        .filter(orderItem => orderItem.orderId === order.id)
        .map(orderItem => ({
          description: orderItem.description,
          id: orderItem.id,
          menuId: orderItem.menuId,
          price: orderItem.price,
        } as OrderItem));
    }

    return { dinerId: user.id, orders: orders as DinerOrder[], page };
  }

  async addDinerOrder(user: UserData, order: DinerOrder): Promise<DinerOrder> {
    const orderId = ++this.dinerOrderId;
    this.dinerOrders.push({ dinerId: user.id, franchiseId: order.franchiseId, date: new Date(), id: orderId, storeId: order.storeId } as DinerOrder);

    for (const item of order.items) {
      const menuItem = this.menuItems.find(menuItem => menuItem.id === item.menuId);

      if (!menuItem) throw new Error("unknown menu item");

      this.orderItems.push({ 
        orderId, 
        menuId: menuItem.id, 
        description: menuItem.description, 
        price: menuItem.price, 
        id: ++this.orderItemId, 
      });
    }

    return { ...order, id: orderId };
  }

  private async getUserNoAuth(userToFind: UserData): Promise<UserData> {
    return this.users.find(user => user.id === userToFind.id || user.email === userToFind.email)!;
  }

  async createFranchise(franchise: Franchise): Promise<Franchise> {
    franchise = { 
      ...franchise,
      admins: franchise.admins?.map(
        admin => ({ ...admin, roles: admin.roles?.map(
          role => ({ ...role })) }
        ),
      ),
    };

    for (const admin of franchise.admins) {
      const adminUser = await this.getUserNoAuth(admin);
      if (!adminUser) throw new StatusCodeError(
        `unknown user for franchise admin ${admin.email} provided`,
        404,
      );
      admin.id = adminUser.id;
      admin.name = adminUser.name;
    }

    this.franchises.push({ name: franchise.name, id: ++this.franchiseId } as Franchise);

    franchise.id = this.franchiseId;

    for (const admin of franchise.admins) {
      this.roles.push({
        userId: admin.id,
        role: Role.FRANCHISEE,
        objectId: franchise.id, 
      });
    }

    return franchise;
  }

  async deleteFranchise(franchiseId: number): Promise<void> {
    this.stores = this.stores.filter(store => store.franchiseId !== franchiseId);
    this.roles = this.roles.filter(role => role.objectId !== franchiseId);
    this.franchises = this.franchises.filter(franchise => franchise.id !== franchiseId);
  }

  async getFranchises(authUser?: UserData): Promise<Franchise[]> {
    const franchises: Franchise[] = [];

    for (const franchise of this.franchises) {
      if (authUser?.isRole(Role.ADMIN)) {
        franchises.push(await this.getFranchise(franchise));
      } else {
        franchises.push({ 
          id: franchise.id, 
          name: franchise.name, 
          stores: this.stores
            .filter(store => store.franchiseId === franchise.id)
            .map(store => ({ id: store.id, name: store.name })) as Store[] ?? [],
        } as Franchise);
      }
    }

    return franchises;
  }

  async getFranchise(toSearch: Franchise): Promise<Franchise> {
    if (!this.franchises.filter(franchise => franchise.id === toSearch.id).length) return undefined!;

    const franchise = { 
      id: toSearch.id, 
      name: toSearch.name, 
      stores: this.stores
        .filter(store => store.franchiseId === toSearch.id)
        .map(store => ({ id: store.id, name: store.name })) as Store[] ?? [],
    } as Franchise;

    const roles = this.roles.filter(role => role.role === Role.FRANCHISEE && role.objectId === franchise.id);

    const adminIds = new Set(roles.map(role => role.userId!));
    
    franchise.admins = this.users
      .filter(user => adminIds.has(user.id))
      .map(user => ({ 
        name: user.name, 
        email: user.email, 
        id: user.id, 
      })) as UserData[];

    const orders = this.dinerOrders.filter(dO => dO.franchiseId === toSearch.id);

    const orderIdToDo: Record<number, DinerOrder> = {};

    for (const order of orders) orderIdToDo[order.id] = order;

    const storeOrders: Record<number, number> = {};

    for (const { id } of franchise.stores) {
      storeOrders[id] = 0;
    }

    for (const item of this.orderItems) {
      if (!orderIdToDo[item.orderId]) continue;

      const order = orderIdToDo[item.orderId];

      storeOrders[order.storeId] += item.price;
    }

    for (const store of franchise.stores) {
      store.totalRevenue = storeOrders[store.id];
    }

    return franchise;
  }

  async getUserFranchises(userId: number): Promise<Franchise[]> {
    const rawFranchiseIds = this.roles.filter(role => role.role === Role.FRANCHISEE && role.userId === userId);

    if (!rawFranchiseIds.length) return [];

    const franchiseIds = new Set(rawFranchiseIds.map(v => v.objectId));

    const franchises = this.franchises.filter(franchise => franchiseIds.has(franchise.id));

    const toReturn: Franchise[] = [];

    for (const franchise of franchises) {
      toReturn.push(await this.getFranchise(franchise));
    }

    return toReturn;
  }

  async createStore(franchiseId: number, store: Store): Promise<Store> {
    this.stores.push({ franchiseId, name: store.name, id: ++this.storeId });
    return { id: this.storeId, franchiseId, name: store.name };
  }

  async deleteStore(franchiseId: number, storeId: number): Promise<void> {
    this.stores = this.stores.filter(store => store.id !== storeId || store.franchiseId !== franchiseId);
  }
  
  async clear(): Promise<void> {
    this.users = [];
    this.userId = 0;

    this.roles = [];

    this.franchises = [];
    this.franchiseId = 0;

    this.auth = {};

    this.stores = [];
    this.storeId = 0;

    this.menuItems = [];
    this.menuItemId = 0;

    this.dinerOrders = [];
    this.dinerOrderId = 0;

    this.orderItems = [];
    this.orderItemId = 0;

    this.initialized = this.initialize();
  }

  private getTokenSignature(token: string): string {
    const parts = token.split(".");
    if (parts.length > 2) {
      return parts[2];
    }
    return "";
  }

  private getOffset(listPerPage: number, currentPage = 1): number {
    return (currentPage - 1) * listPerPage;
  }
}
