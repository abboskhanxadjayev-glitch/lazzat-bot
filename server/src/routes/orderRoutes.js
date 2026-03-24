import { Router } from "express";
import { createOrder, getOrderById, getOrders } from "../services/orderService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createOrderSchema } from "../utils/validation.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const orders = await getOrders();
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