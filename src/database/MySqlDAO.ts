import {
  Connection,
  createConnection,
  QueryResult,
  ResultSetHeader,
} from "mysql2/promise";
import { compare, hash } from "bcrypt";
import { Franchise, Item, Order, Role, Store, UserData, UserOrders } from "../model";
import { StatusCodeError } from "../endpointHelper";
import { tableCreateStatements } from "./dbModel";
import config from "../config";
import { DatabaseDAO } from "./DatabaseDAO";

export class MySqlDAO implements DatabaseDAO {
  private initialized: Promise<void>;

  private static _instance: MySqlDAO;

  static async getInstance(): Promise<DatabaseDAO> {
    if (this._instance) return this._instance;

    const temp = new MySqlDAO();
    
    await temp.initialized;

    return this._instance = temp;
  }

  private constructor() {
    this.initialized = this.initializeDatabase();
  }

  async getMenu(): Promise<Item[]> {
    const connection = await this.getConnection();
    try {
      const rows = await this.query<Item[]>(connection, "SELECT * FROM menu");
      return rows;
    } finally {
      connection.end();
    }
  }

  async addMenuItem(item: Item): Promise<Item> {
    const connection = await this.getConnection();
    try {
      const addResult = await this.query<ResultSetHeader>(
        connection,
        "INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)",
        [item.title, item.description, item.image, item.price],
      );
      return { ...item, id: addResult.insertId };
    } finally {
      connection.end();
    }
  }

  async addUser(user: UserData): Promise<UserData> {
    const connection = await this.getConnection();
    try {
      const hashedPassword = await hash(user.password!, 10);

      const userResult = await this.query<ResultSetHeader>(
        connection,
        "INSERT INTO user (name, email, password) VALUES (?, ?, ?)",
        [user.name, user.email, hashedPassword],
      );
      const userId = userResult.insertId;
      for (const role of user.roles) {
        switch (role.role) {
          case Role.FRANCHISEE: {
            const franchiseId = await this.getID(
              connection,
              "name",
              role.object,
              "franchise",
            );
            await this.query(
              connection,
              "INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)",
              [userId, role.role, franchiseId],
            );
            break;
          }
          default: {
            await this.query(
              connection,
              "INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)",
              [userId, role.role, 0],
            );
            break;
          }
        }
      }
      return { ...user, id: userId, password: undefined };
    } finally {
      connection.end();
    }
  }

  async getUser(providedUser: UserData): Promise<UserData> {
    const connection = await this.getConnection();
    try {
      const userResult = await this.query<UserData[]>(
        connection,
        "SELECT * FROM user WHERE email=?",
        [providedUser.email],
      );
      const user = userResult[0];
      if (!user || !(await compare(providedUser.password!, user.password!))) {
        throw new StatusCodeError("unknown user", 404);
      }

      const roleResult = await this.query<{ objectId?: number; role: Role }[]>(
        connection,
        "SELECT * FROM userRole WHERE userId=?",
        [user.id],
      );
      const roles = roleResult.map((r) => {
        return { objectId: r.objectId || undefined, role: r.role };
      });

      return { ...user, roles: roles, password: undefined };
    } finally {
      connection.end();
    }
  }

  async updateUser(updatedUser: UserData): Promise<UserData> {
    const connection = await this.getConnection();
    try {
      const params: string[] = [];
      if (updatedUser.password) {
        const hashedPassword = await hash(updatedUser.password, 10);
        params.push(`password='${hashedPassword}'`);
      }
      if (updatedUser.email) {
        params.push(`email='${updatedUser.email}'`);
      }
      if (params.length > 0) {
        const query = `UPDATE user SET ${params.join(", ")} WHERE id=${updatedUser.id}`;
        await this.query(connection, query);
      }
      return this.getUser(updatedUser);
    } finally {
      connection.end();
    }
  }

  async loginUser(userId: number, token: string): Promise<void> {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      await this.query(
        connection,
        "INSERT INTO auth (token, userId) VALUES (?, ?)",
        [token, userId],
      );
    } finally {
      connection.end();
    }
  }

  async isLoggedIn(token: string): Promise<boolean> {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      const authResult = await this.query<[]>(
        connection,
        "SELECT userId FROM auth WHERE token=?",
        [token],
      );
      return authResult.length > 0;
    } finally {
      connection.end();
    }
  }

  async logoutUser(token: string): Promise<void> {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      await this.query(connection, "DELETE FROM auth WHERE token=?", [token]);
    } finally {
      connection.end();
    }
  }

  async getOrders(user: UserData, page = 1): Promise<UserOrders> {
    const connection = await this.getConnection();
    try {
      const offset = this.getOffset(config.db.listPerPage, page);
      const orders = await this.query<Order[]>(
        connection,
        `SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${config.db.listPerPage}`,
        [user.id],
      );
      for (const order of orders) {
        const items = await this.query<Item[]>(
          connection,
          "SELECT id, menuId, description, price FROM orderItem WHERE orderId=?",
          [order.id],
        );
        order.items = items;
      }
      return { dinerId: user.id, orders, page };
    } finally {
      connection.end();
    }
  }

  async addDinerOrder(user: UserData, order: Order): Promise<Order> {
    const connection = await this.getConnection();
    try {
      const orderResult = await this.query<ResultSetHeader>(
        connection,
        "INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())",
        [user.id, order.franchiseId, order.storeId],
      );
      const orderId = orderResult.insertId;
      for (const item of order.items) {
        const menuId = await this.getID(connection, "id", item.menuId, "menu");
        await this.query(
          connection,
          "INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)",
          [orderId, menuId, item.description, item.price],
        );
      }
      return { ...order, id: orderId };
    } finally {
      connection.end();
    }
  }

  async createFranchise(franchise: Franchise): Promise<Franchise> {
    const connection = await this.getConnection();
    try {
      for (const admin of franchise.admins) {
        const adminUser = await this.query<UserData[]>(
          connection,
          "SELECT id, name FROM user WHERE email=?",
          [admin.email],
        );
        if (adminUser.length == 0) {
          throw new StatusCodeError(
            `unknown user for franchise admin ${admin.email} provided`,
            404,
          );
        }
        admin.id = adminUser[0].id;
        admin.name = adminUser[0].name;
      }

      const franchiseResult = await this.query<ResultSetHeader>(
        connection,
        "INSERT INTO franchise (name) VALUES (?)",
        [franchise.name],
      );
      franchise.id = franchiseResult.insertId;

      for (const admin of franchise.admins) {
        await this.query(
          connection,
          "INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)",
          [admin.id, Role.FRANCHISEE, franchise.id],
        );
      }

      return franchise;
    } finally {
      connection.end();
    }
  }

  async deleteFranchise(franchiseId: number): Promise<void> {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      try {
        await this.query(connection, "DELETE FROM store WHERE franchiseId=?", [
          franchiseId,
        ]);
        await this.query(connection, "DELETE FROM userRole WHERE objectId=?", [
          franchiseId,
        ]);
        await this.query(connection, "DELETE FROM franchise WHERE id=?", [
          franchiseId,
        ]);
        await connection.commit();
      } catch {
        await connection.rollback();
        throw new StatusCodeError("unable to delete franchise", 500);
      }
    } finally {
      connection.end();
    }
  }

  async getFranchises(authUser: UserData): Promise<Franchise[]> {
    const connection = await this.getConnection();
    try {
      const franchises = await this.query<Franchise[]>(
        connection,
        "SELECT id, name FROM franchise",
      );
      for (const franchise of franchises) {
        if (authUser?.isRole(Role.ADMIN)) {
          await this.getFranchise(franchise);
        } else {
          franchise.stores = await this.query<Store[]>(
            connection,
            "SELECT id, name FROM store WHERE franchiseId=?",
            [franchise.id],
          );
        }
      }
      return franchises;
    } finally {
      connection.end();
    }
  }

  async getUserFranchises(userId: number): Promise<Franchise[]> {
    const connection = await this.getConnection();
    try {
      const rawFranchiseIds = await this.query<{ objectId: number }[]>(
        connection,
        "SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?",
        [userId],
      );
      if (rawFranchiseIds.length === 0) {
        return [];
      }

      const franchiseIds = rawFranchiseIds.map((v) => v.objectId);
      const franchises = await this.query<Franchise[]>(
        connection,
        `SELECT id, name FROM franchise WHERE id in (${franchiseIds.join(",")})`,
      );
      for (const franchise of franchises) {
        await this.getFranchise(franchise);
      }
      return franchises;
    } finally {
      connection.end();
    }
  }

  async getFranchise(franchise: Franchise): Promise<Franchise> {
    const connection = await this.getConnection();
    try {
      franchise.admins = await this.query(
        connection,
        "SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'",
        [franchise.id],
      );

      franchise.stores = await this.query(
        connection,
        "SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id",
        [franchise.id],
      );

      return franchise;
    } finally {
      connection.end();
    }
  }

  async createStore(franchiseId: number, store: Store): Promise<Store> {
    const connection = await this.getConnection();
    try {
      const insertResult = await this.query<ResultSetHeader>(
        connection,
        "INSERT INTO store (franchiseId, name) VALUES (?, ?)",
        [franchiseId, store.name],
      );
      return { id: insertResult.insertId, franchiseId, name: store.name };
    } finally {
      connection.end();
    }
  }

  async deleteStore(franchiseId: number, storeId: number): Promise<void> {
    const connection = await this.getConnection();
    try {
      await this.query(
        connection,
        "DELETE FROM store WHERE franchiseId=? AND id=?",
        [franchiseId, storeId],
      );
    } finally {
      connection.end();
    }
  }

  private getOffset(listPerPage: number, currentPage = 1): number {
    return (currentPage - 1) * listPerPage;
  }

  private getTokenSignature(token: string): string {
    const parts = token.split(".");
    if (parts.length > 2) {
      return parts[2];
    }
    return "";
  }

  private async query<T = QueryResult>(
    connection: Connection,
    sql: string,
    params?: any[],
  ): Promise<T> {
    console.log(`${sql};${params}`);

    const [results] = await connection.execute(sql, params);
    return results as T;
  }

  private async getID(
    connection: Connection,
    key: string | number,
    value: any,
    table: string,
  ): Promise<number> {
    const [rows] = await this.query<ResultSetHeader & { id: number }[][]>(
      connection,
      `SELECT id FROM ${table} WHERE ${key}=?`,
      [value],
    );
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new Error("No ID found");
  }

  private async getConnection(): Promise<Connection> {
    // Make sure the database is initialized before trying to get a connection.
    await this.initialized;
    return this._getConnection();
  }

  private async _getConnection(setUse = true): Promise<Connection> {
    const connection = await createConnection({
      host: config.db.connection.host,
      user: config.db.connection.user,
      password: config.db.connection.password,
      connectTimeout: config.db.connection.connectTimeout,
      decimalNumbers: true,
    });
    if (setUse) {
      await connection.query(`USE ${config.db.connection.database}`);
    }
    return connection;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const connection = await this._getConnection(false);
      try {
        const dbExists = await this.checkDatabaseExists(connection);
        console.log(
          dbExists ? "Database exists" : "Database does not exist, creating it",
        );

        await connection.query(
          `CREATE DATABASE IF NOT EXISTS ${config.db.connection.database}`,
        );
        await connection.query(`USE ${config.db.connection.database}`);

        if (!dbExists) {
          console.log("Successfully created database");
        }

        for (const statement of tableCreateStatements) {
          await connection.query(statement);
        }

        if (!dbExists) {
          const defaultAdmin = {
            name: "常用名字",
            email: "a@jwt.com",
            password: "admin",
            roles: [{ role: Role.ADMIN }],
          } as UserData;
          this.addUser(defaultAdmin);
        }
      } finally {
        connection.end();
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          message: "Error initializing database",
          exception: (err as any)?.message,
          connection: config.db.connection,
        }),
      );
    }
  }

  private async checkDatabaseExists(connection: Connection) {
    const rows = await this.query<[]>(
      connection,
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [config.db.connection.database],
    );
    return rows.length > 0;
  }
}
