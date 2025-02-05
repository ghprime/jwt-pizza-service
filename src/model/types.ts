export interface UserData {
  name: string;
  password?: string;
  email: string;
  roles: RoleData[];
  id: number;
  isRole: (role: Role) => boolean;
}

export type RoleData = {
  role: Role;
  object?: any;
  objectId?: number;
  userId?: number;
};

export enum Role {
  DINER = "diner",
  FRANCHISEE = "franchisee",
  ADMIN = "admin",
}

export type DinerOrder = {
  id: number;
  franchiseId: number;
  storeId: number;
  date: Date;
  dinerId: number;
  items: OrderItem[];
}

export type Order = {
  dinerId: number;
  orders: DinerOrder[]
  page: number;
}

export type OrderItem = {
  id: number;
  orderId: number;
  menuId: number;
  description: string;
  price: number;
}

export type MenuItem = {
  id: number;
  title: string;
  image: string;
  price: number;
  description: string;
}

export type Franchise = {
  admins: UserData[];
  id: number;
  name: string;
  stores: Store[];
};

export type Store = {
  name: string;
  id: number;
  franchiseId: number;
  totalRevenue?: number;
};
