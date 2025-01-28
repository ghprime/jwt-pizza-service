import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../endpointHelper";
import config from "../config";
import { Role, UserData } from "../model";
import { DatabaseDAO } from "../database";

export const authRouter = Router();

export const authRouterEndpoints = [
  {
    method: "POST",
    path: "/api/auth",
    description: "Register a new user",
    example:
      "curl -X POST localhost:3000/api/auth -d '{\"name\":\"pizza diner\", \"email\":\"d@jwt.com\", \"password\":\"diner\"}' -H 'Content-Type: application/json'",
    response: {
      user: {
        id: 2,
        name: "pizza diner",
        email: "d@jwt.com",
        roles: [{ role: "diner" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth",
    description: "Login existing user",
    example:
      "curl -X PUT localhost:3000/api/auth -d '{\"email\":\"a@jwt.com\", \"password\":\"admin\"}' -H 'Content-Type: application/json'",
    response: {
      user: {
        id: 1,
        name: "常用名字",
        email: "a@jwt.com",
        roles: [{ role: "admin" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth/:userId",
    requiresAuth: true,
    description: "Update user",
    example:
      "curl -X PUT localhost:3000/api/auth/1 -d '{\"email\":\"a@jwt.com\", \"password\":\"admin\"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'",
    response: {
      id: 1,
      name: "常用名字",
      email: "a@jwt.com",
      roles: [{ role: "admin" }],
    },
  },
  {
    method: "DELETE",
    path: "/api/auth",
    requiresAuth: true,
    description: "Logout a user",
    example:
      "curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'",
    response: { message: "logout successful" },
  },
];

export const setAuthUser = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = readAuthToken(req);
  const dao = res.locals.dao;
  if (token) {
    try {
      if (await dao.isLoggedIn(token)) {
        // Check the database to make sure the token is valid.
        // token is hashed user
        const user = jwt.verify(token, config.jwtSecret) as unknown as UserData;
        res.locals.user = user;
        user.isRole = (role: Role) =>
          !!res.locals.user.roles.find((r) => r.role === role);
      }
    } catch {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      res.locals.user = undefined;
    }
  }
  next();
});

// Authenticate token
export const authenticateToken = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!res.locals.user) {
    res.status(401).send({ message: "unauthorized" });
    return;
  }
  next();
};

// register
authRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }
    const dao = res.locals.dao;
    const user = await dao.addUser({
      name,
      email,
      password,
      roles: [{ role: Role.DINER }],
    } as UserData);
    const auth = await setAuth(user, res.locals.dao);
    res.json({ user: user, token: auth });
  }),
);

// login
authRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const dao = res.locals.dao;
    const user = await dao.getUser({ email, password } as UserData);
    const auth = await setAuth(user, res.locals.dao);
    res.json({ user: user, token: auth });
  }),
);

// logout
authRouter.delete(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    await clearAuth(req, res.locals.dao);
    res.json({ message: "logout successful" });
  }),
);

// updateUser
authRouter.put(
  "/:userId",
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const id = Number(req.params.userId);
    const user = res.locals.user;
    if (user.id !== id && !user.isRole(Role.ADMIN)) {
      return res.status(403).json({ message: "unauthorized" });
    }

    const dao = res.locals.dao;
    const updatedUser = await dao.updateUser({
      id,
      email,
      password,
    } as UserData);
    res.json(updatedUser);
  }),
);

async function setAuth(user: UserData, dao: DatabaseDAO) {
  const token = jwt.sign(user, config.jwtSecret);
  await dao.loginUser(user.id, token);
  return token;
}

async function clearAuth(req: Request, dao: DatabaseDAO) {
  const token = readAuthToken(req);
  if (token) {
    await dao.logoutUser(token);
  }
}

function readAuthToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(" ")[1];
  }
  return null;
}
