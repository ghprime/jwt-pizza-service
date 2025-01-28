import { Franchise, Item, Order, Store, UserData, UserOrders } from "../model";

export interface DatabaseDAO {
  getMenu(): Promise<Item[]>;
  addMenuItem(item: Item): Promise<Item>;
  addUser(user: UserData): Promise<UserData>;
  getUser(providedUser: UserData): Promise<UserData>;
  updateUser(updatedUser: UserData): Promise<UserData>;
  loginUser(userId: number, token: string): Promise<void>;
  isLoggedIn(token: string): Promise<boolean>;
  logoutUser(token: string): Promise<void>;
  getOrders(user: UserData, page?: number): Promise<UserOrders>;
  addDinerOrder(user: UserData, order: Order): Promise<Order>;
  createFranchise(franchise: Franchise): Promise<Franchise>;
  deleteFranchise(franchiseId: number): Promise<void>;
  getFranchises(authUser: UserData): Promise<Franchise[]>;
  getUserFranchises(userId: number): Promise<Franchise[]>;
  getFranchise(franchise: Franchise): Promise<Franchise>;
  createStore(franchiseId: number, store: Store): Promise<Store>;
  deleteStore(franchiseId: number, storeId: number): Promise<void>;
}
