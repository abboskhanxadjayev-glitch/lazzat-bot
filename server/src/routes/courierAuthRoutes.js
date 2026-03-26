import { Router } from "express";
import { requireCourierAuth } from "../middleware/requireCourierAuth.js";
import { authenticateCourier } from "../services/courierAuthService.js";
import {
  acceptCourierOrder,
  deliverCourierOrder,
  getOrdersByCourierId
} from "../services/orderService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { courierLoginSchema } from "../utils/validation.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = courierLoginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Courier login ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const { token, courier } = await authenticateCourier(parsed.data);

    res.json({
      message: "Courier login muvaffaqiyatli bajarildi.",
      data: {
        token,
        courier
      }
    });
  })
);

router.get(
  "/orders",
  requireCourierAuth,
  asyncHandler(async (req, res) => {
    const orders = await getOrdersByCourierId(req.courierAuth.courierId);
    res.json({ data: orders });
  })
);

router.post(
  "/orders/:orderId/accept",
  requireCourierAuth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw createAppError(400, "Buyurtma ID kiritilishi kerak.");
    }

    const order = await acceptCourierOrder(orderId, req.courierAuth.courierId);

    res.json({
      message: "Buyurtma qabul qilindi.",
      data: order
    });
  })
);

router.post(
  "/orders/:orderId/deliver",
  requireCourierAuth,
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw createAppError(400, "Buyurtma ID kiritilishi kerak.");
    }

    const order = await deliverCourierOrder(orderId, req.courierAuth.courierId);

    res.json({
      message: "Buyurtma yetkazildi.",
      data: order
    });
  })
);

export default router;