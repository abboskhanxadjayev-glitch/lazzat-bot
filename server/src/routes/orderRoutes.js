import { Router } from "express";
import {
  assignCourierToOrder,
  createOrder,
  getOrderById,
  getOrders,
  getOrdersByTelegramUserId,
  updateOrderStatus
} from "../services/orderService.js";
import { getCourierOrdersByIdForPortal } from "../services/courierAuthService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { tryResolveCourierAuth } from "../utils/courierAuth.js";
import { resolveTelegramIdentity } from "../utils/telegramAuth.js";
import {
  assignCourierSchema,
  createOrderSchema,
  updateOrderStatusSchema
} from "../utils/validation.js";

const router = Router();

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
    const courierAuth = tryResolveCourierAuth(req.headers.authorization || "");

    if (courierAuth) {
      const orders = await getCourierOrdersByIdForPortal(courierAuth.courierId);
      res.json({ data: orders });
      return;
    }

    const telegramIdentity = resolveTelegramIdentity(req);
    const orders = await getOrdersByTelegramUserId(telegramIdentity.telegramUserId);
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

router.patch(
  "/:orderId/courier",
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw createAppError(400, "Buyurtma ID kiritilishi kerak.");
    }

    const parsed = assignCourierSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer biriktirish ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const order = await assignCourierToOrder(orderId, parsed.data.courierId || null);

    res.json({
      message: parsed.data.courierId ? "Kuryer biriktirildi." : "Kuryer biriktirishi olib tashlandi.",
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

    let orderPayload = parsed.data;

    try {
      const telegramIdentity = resolveTelegramIdentity(req, {
        allowQueryFallback: false,
        fieldLabel: "Telegram foydalanuvchi ma'lumotlari"
      });

      if (!orderPayload.telegramUser && telegramIdentity.telegramUser) {
        orderPayload = {
          ...orderPayload,
          telegramUser: telegramIdentity.telegramUser
        };
      }
    } catch {
      // Order creation also works for non-Telegram contexts, so this identity augmentation stays optional.
    }

    const order = await createOrder(orderPayload);
    res.status(201).json({
      message: "Buyurtma muvaffaqiyatli yaratildi.",
      data: order
    });
  })
);

export default router;
