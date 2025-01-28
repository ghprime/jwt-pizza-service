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
};

export enum Role {
  DINER = "diner",
  FRANCHISEE = "franchisee",
  ADMIN = "admin",
}

export type Order = {
  items: Item[];
  id: number;
  franchiseId: number;
  storeId: number;
};

export type UserOrders = {
  dinerId: number;
  orders: Order[];
  page: number;
}

export type Item = {
  menuId: number;
  title: string;
  description: string;
  price: number;
  image: string;
  id: number;
};

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
};
