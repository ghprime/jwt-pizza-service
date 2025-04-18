import { Router } from "express";
import config from "../config";
import { authenticateToken } from "./authRouter";
import { asyncHandler, StatusCodeError } from "../endpointHelper";
import { OrderItem, Role } from "../model";
import { LatencyMetric, PizzaMetric } from "../metrics";
import { checkChaos, setChaos } from "../chaos";

export const orderRouter = Router();

orderRouter.use(checkChaos);

export const orderRouterEndpoints = [
  {
    method: "GET",
    path: "/api/order/menu",
    description: "Get the pizza menu",
    example: "curl localhost:3000/api/order/menu",
    response: [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
    ],
  },
  {
    method: "PUT",
    path: "/api/order/menu",
    requiresAuth: true,
    description: "Add an item to the menu",
    example:
      "curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ \"title\":\"Student\", \"description\": \"No topping, no sauce, just carbs\", \"image\":\"pizza9.png\", \"price\": 0.0001 }'  -H 'Authorization: Bearer tttttt'",
    response: [
      {
        id: 1,
        title: "Student",
        description: "No topping, no sauce, just carbs",
        image: "pizza9.png",
        price: 0.0001,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/order",
    requiresAuth: true,
    description: "Get the orders for the authenticated user",
    example:
      "curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'",
    response: {
      dinerId: 4,
      orders: [
        {
          id: 1,
          franchiseId: 1,
          storeId: 1,
          date: "2024-06-05T05:14:40.000Z",
          items: [{ id: 1, menuId: 1, description: "Veggie", price: 0.05 }],
        },
      ],
      page: 1,
    },
  },
  {
    method: "POST",
    path: "/api/order",
    requiresAuth: true,
    description: "Create a order for the authenticated user",
    example:
      "curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}'  -H 'Authorization: Bearer tttttt'",
    response: {
      order: {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
        id: 1,
      },
      jwt: "1111111111",
    },
  },
];

// getMenu
orderRouter.get(
  "/menu",
  asyncHandler(async (_req, res) => {
    const dao = res.locals.dao;
    res.send(await dao.getMenu());
  }),
);

// addMenuItem
orderRouter.put(
  "/menu",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const dao = res.locals.dao;
    if (!res.locals.user.isRole(Role.ADMIN)) {
      throw new StatusCodeError("unable to add menu item", 403);
    }

    const addMenuItemReq = req.body;
    await dao.addMenuItem(addMenuItemReq);
    res.send(await dao.getMenu());
  }),
);

// getOrders
orderRouter.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const dao = res.locals.dao;
    res.json(await dao.getOrders(res.locals.user, req.query.page ? +req.query.page : undefined));
  }),
);

orderRouter.put("/chaos/:state", setChaos("/api/order", { method: "POST" }));

// createOrder
orderRouter.post(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const pizzaMetrics = res.locals.metrics.pizza;
    const latencyMetrics = res.locals.metrics.latency;
    const logger = res.locals.logger;

    const start = Date.now();

    const orderReq = req.body;
    const dao = res.locals.dao;
    const order = await dao.addDinerOrder(res.locals.user, orderReq);
    const r = await fetch(`${config.factory.url}/api/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${config.factory.apiKey}`,
      },
      body: JSON.stringify({
        diner: {
          id: res.locals.user.id,
          name: res.locals.user.name,
          email: res.locals.user.email,
        },
        order,
      }),
    });
    const j = await r.json();
    if (r.ok) {
      res.send({ order, reportSlowPizzaToFactoryUrl: j.reportUrl, jwt: j.jwt });
      pizzaMetrics.add(PizzaMetric.SOLD, order.items.length);
      pizzaMetrics.add(PizzaMetric.REVENUE, order.items.reduce((tot: number, item: OrderItem) => tot + item.price, 0));
      logger.info({
        type: "factory",
        message: "Pizza factory created pizza(s)",
        response: j,
      });
    } else {
      res.status(500).send({
        message: "Failed to fulfill order at factory",
        reportPizzaCreationErrorToPizzaFactoryUrl: j.reportUrl,
      });
      pizzaMetrics.add(PizzaMetric.CREATION_FAILURE, order.items.length);
      logger.error({
        type: "factory",
        error: "Pizza factory error",
        response: j,
      });
    }

    latencyMetrics.add(LatencyMetric.PIZZA_CREATION, Date.now() - start);
  }),
);
