import { DatabaseDAO, MySqlDAO } from "./database";

export interface Context {
  dao(): Promise<DatabaseDAO>;
}

export class ContextFactory {
  private static _context?: Context;

  static setContext(context: Context) {
    this._context = context;
  }

  static resetContext() {
    this._context = undefined;
  }

  static context(): Context {
    if (!this._context) this._context = {
      dao: () => MySqlDAO.getInstance(),
    };

    return this._context;
  }
};
