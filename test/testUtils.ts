import { MemoryDAO } from "../src";
import { Context } from "../src/context";
import * as crypto from "node:crypto";


export const createContext = (): Context => {
  const dao = MemoryDAO.createInstance();

  return {
    async dao() {
      return dao;
    },
  };
};

export const getRandomString = () => {
  return crypto.randomBytes(20).toString("hex");
};

export const newUser = () => ({
  password: getRandomString(),
  name: getRandomString(),
  email: `${getRandomString()}@email.com`,
});


export const exclude = (obj: Record<string, any>, toExclude: string[]) => {
  const keys = Object.keys(obj);

  const excluding = new Set(toExclude);

  return keys.reduce((ob, key) => {
    if (excluding.has(key)) return ob;
    ob[key] = obj[key];
    return ob;
  }, {} as Record<string, any>);
};
