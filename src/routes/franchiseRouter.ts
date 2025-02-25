import { Router } from "express";
import { authenticateToken } from "./authRouter";
import { StatusCodeError, asyncHandler } from "../endpointHelper";
import { Franchise, Role, UserData } from "../model";

export const franchiseRouter = Router();

export const franchiseRouterEndpoints = [
  {
    method: "GET",
    path: "/api/franchise",
    description: "List all the franchises",
    example: "curl localhost:3000/api/franchise",
    response: [
      {
        id: 1,
        name: "pizzaPocket",
        admins: [{ id: 4, name: "pizza franchisee", email: "f@jwt.com" }],
        stores: [{ id: 1, name: "SLC", totalRevenue: 0 }],
      },
    ],
  },
  {
    method: "GET",
    path: "/api/franchise/:userId",
    requiresAuth: true,
    description: "List a user's franchises",
    example:
      "curl localhost:3000/api/franchise/4  -H 'Authorization: Bearer tttttt'",
    response: [
      {
        id: 2,
        name: "pizzaPocket",
        admins: [{ id: 4, name: "pizza franchisee", email: "f@jwt.com" }],
        stores: [{ id: 4, name: "SLC", totalRevenue: 0 }],
      },
    ],
  },
  {
    method: "POST",
    path: "/api/franchise",
    requiresAuth: true,
    description: "Create a new franchise",
    example:
      "curl -X POST localhost:3000/api/franchise -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt' -d '{\"name\": \"pizzaPocket\", \"admins\": [{\"email\": \"f@jwt.com\"}]}'",
    response: {
      name: "pizzaPocket",
      admins: [{ email: "f@jwt.com", id: 4, name: "pizza franchisee" }],
      id: 1,
    },
  },
  {
    method: "DELETE",
    path: "/api/franchise/:franchiseId",
    requiresAuth: true,
    description: "Delete a franchises",
    example:
      "curl -X DELETE localhost:3000/api/franchise/1 -H 'Authorization: Bearer tttttt'",
    response: { message: "franchise deleted" },
  },
  {
    method: "POST",
    path: "/api/franchise/:franchiseId/store",
    requiresAuth: true,
    description: "Create a new franchise store",
    example:
      "curl -X POST localhost:3000/api/franchise/1/store -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"name\":\"SLC\"}' -H 'Authorization: Bearer tttttt'",
    response: { id: 1, name: "SLC", totalRevenue: 0 },
  },
  {
    method: "DELETE",
    path: "/api/franchise/:franchiseId/store/:storeId",
    requiresAuth: true,
    description: "Delete a store",
    example:
      "curl -X DELETE localhost:3000/api/franchise/1/store/1  -H 'Authorization: Bearer tttttt'",
    response: { message: "store deleted" },
  },
];

// getFranchises
franchiseRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const dao = res.locals.dao;
    res.json(await dao.getFranchises(res.locals.user));
  }),
);

// getUserFranchises
franchiseRouter.get(
  "/:userId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    let result: Franchise[] = [];
    const userId = Number(req.params.userId);
    if (res.locals.user.id === userId || res.locals.user.isRole(Role.ADMIN)) {
      const dao = res.locals.dao;
      result = await dao.getUserFranchises(userId);
    }

    res.json(result);
  }),
);

// createFranchise
franchiseRouter.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    if (!res.locals.user.isRole(Role.ADMIN)) {
      throw new StatusCodeError("unable to create a franchise", 403);
    }

    const franchise = req.body;
    const dao = res.locals.dao;
    res.send(await dao.createFranchise(franchise));
  }),
);

// deleteFranchise
franchiseRouter.delete(
  "/:franchiseId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    if (!res.locals.user.isRole(Role.ADMIN)) {
      throw new StatusCodeError("unable to delete a franchise", 403);
    }

    const franchiseId = Number(req.params.franchiseId);
    const dao = res.locals.dao;
    await dao.deleteFranchise(franchiseId);
    res.json({ message: "franchise deleted" });
  }),
);

// createStore
franchiseRouter.post(
  "/:franchiseId/store",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const franchiseId = Number(req.params.franchiseId);
    const dao = res.locals.dao;
    const franchise = await dao.getFranchise({ id: franchiseId } as Franchise);
    if (
      !franchise ||
      (!res.locals.user.isRole(Role.ADMIN) &&
        !franchise.admins.some((admin: UserData) => admin.id === res.locals.user.id))
    ) {
      throw new StatusCodeError("unable to create a store", 403);
    }

    res.send(await dao.createStore(franchise.id, req.body));
  }),
);

// deleteStore
franchiseRouter.delete(
  "/:franchiseId/store/:storeId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const franchiseId = Number(req.params.franchiseId);
    const dao = res.locals.dao;
    const franchise = await dao.getFranchise({ id: franchiseId } as Franchise);
    if (
      !franchise ||
      (!res.locals.user.isRole(Role.ADMIN) &&
        !franchise.admins.some((admin: UserData) => admin.id === res.locals.user.id))
    ) {
      throw new StatusCodeError("unable to delete a store", 403);
    }

    const storeId = Number(req.params.storeId);
    await dao.deleteStore(franchiseId, storeId);
    res.json({ message: "store deleted" });
  }),
);
