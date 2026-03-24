import { Router } from "express";
import { createOrder, getOrderById, getOrders, getOrdersByTelegramUserId, updateOrderStatus } from "../services/orderService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createOrderSchema, updateOrderStatusSchema } from "../utils/validation.js";

const router = Router();

function getSingleHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const orders = await getOrders();
    res.json({ data: orders });
  })
);

router.get(
  "/my-orders",
  asyncHandler(async (req, res) => {
    const telegramUserId = getSingleHeaderValue(req.headers["x-telegram-user-id"])
      || getSingleHeaderValue(req.query.telegramUserId);

    if (!telegramUserId) {
      throw createAppError(400, "Telegram user ID kiritilishi kerak.");
    }

    const orders = await getOrdersByTelegramUserId(telegramUserId);
    res.json({ data: orders });
  })
);

router.get(
  "/:orderId",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw createAppError(400, "Buyurtma ID kiritilishi kerak.");
    }

    const order = await getOrderById(orderId);
    res.json({ data: order });
  })
);

router.patch(
  "/:orderId/status",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw createAppError(400, "Buyurtma ID kiritilishi kerak.");
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Status ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const order = await updateOrderStatus(orderId, parsed.data.status);

    res.json({
      message: "Buyurtma statusi yangilandi.",
      data: order
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "So'rov ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const order = await createOrder(parsed.data);
    res.status(201).json({
      message: "Buyurtma muvaffaqiyatli yaratildi.",
      data: order
    });
  })
);

export default router;