import { Router } from "express";
import {
  ensureCourierRegistrationRecord,
  getCourierAssignedOrdersByTelegramUserId,
  getCourierProfileByTelegramUserId,
  getCouriers,
  registerCourier,
  updateCourierOnlineStatus,
  updateCourierProfile,
  updateCourierStatus
} from "../services/courierService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  ensureCourierSchema,
  registerCourierSchema,
  updateCourierOnlineStatusSchema,
  updateCourierProfileSchema,
  updateCourierStatusSchema
} from "../utils/validation.js";

const router = Router();

function getSingleHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" && req.query.status !== "all"
      ? req.query.status
      : null;

    const couriers = await getCouriers(status);
    res.json({ data: couriers });
  })
);

router.post(
  "/ensure",
  asyncHandler(async (req, res) => {
    const parsed = ensureCourierSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer identifikatsiya ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const courier = await ensureCourierRegistrationRecord(parsed.data);
    res.json({
      message: "Kuryer profili tekshirildi.",
      data: courier
    });
  })
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerCourierSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer ro'yxatdan o'tish ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const courier = await registerCourier(parsed.data);
    res.status(201).json({
      message: "Kuryer ro'yxatdan o'tkazildi.",
      data: courier
    });
  })
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const telegramUserId = getSingleHeaderValue(req.headers["x-telegram-user-id"])
      || getSingleHeaderValue(req.query.telegramUserId);

    if (!telegramUserId) {
      throw createAppError(400, "Telegram user ID kiritilishi kerak.");
    }

    const courier = await getCourierProfileByTelegramUserId(telegramUserId);
    res.json({ data: courier });
  })
);

router.get(
  "/me/orders",
  asyncHandler(async (req, res) => {
    const telegramUserId = getSingleHeaderValue(req.headers["x-telegram-user-id"])
      || getSingleHeaderValue(req.query.telegramUserId);

    if (!telegramUserId) {
      throw createAppError(400, "Telegram user ID kiritilishi kerak.");
    }

    const orders = await getCourierAssignedOrdersByTelegramUserId(telegramUserId);
    res.json({ data: orders });
  })
);

router.patch(
  "/:courierId/profile",
  asyncHandler(async (req, res) => {
    const { courierId } = req.params;

    if (!courierId) {
      throw createAppError(400, "Kuryer ID kiritilishi kerak.");
    }

    const parsed = updateCourierProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Courier profile ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const courier = await updateCourierProfile(courierId, parsed.data);

    res.json({
      message: "Kuryer profili yangilandi.",
      data: courier
    });
  })
);

router.patch(
  "/:courierId/status",
  asyncHandler(async (req, res) => {
    const { courierId } = req.params;

    if (!courierId) {
      throw createAppError(400, "Kuryer ID kiritilishi kerak.");
    }

    const parsed = updateCourierStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer status ma'lumotlari noto'g'ri.", parsed.error.flatten());
    }

    const courier = await updateCourierStatus(courierId, parsed.data.status);

    res.json({
      message: "Kuryer statusi yangilandi.",
      data: courier
    });
  })
);

router.patch(
  "/:courierId/online-status",
  asyncHandler(async (req, res) => {
    const { courierId } = req.params;

    if (!courierId) {
      throw createAppError(400, "Kuryer ID kiritilishi kerak.");
    }

    const parsed = updateCourierOnlineStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer online holati noto'g'ri.", parsed.error.flatten());
    }

    const courier = await updateCourierOnlineStatus(courierId, parsed.data.onlineStatus);

    res.json({
      message: "Kuryer online holati yangilandi.",
      data: courier
    });
  })
);

export default router;
