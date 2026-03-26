import { Router } from "express";
import { requireCourierAuth, attachOptionalCourierAuth } from "../middleware/requireCourierAuth.js";
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
import {
  ensureCourierLoginCredentials,
  getCourierOrdersByIdForPortal,
  getCourierProfileByIdForPortal
} from "../services/courierAuthService.js";
import { sendCourierApprovedLoginMessage } from "../services/telegramService.js";
import { createAppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveTelegramIdentity } from "../utils/telegramAuth.js";
import {
  ensureCourierSchema,
  registerCourierSchema,
  updateCourierOnlineStatusSchema,
  updateCourierProfileSchema,
  updateCourierStatusSchema
} from "../utils/validation.js";

const router = Router();
const DEFAULT_COURIER_LOGIN_URL = "https://client-chi-nine-98.vercel.app/courier-login";

function getCourierLoginUrl() {
  const miniAppUrl = process.env.MINI_APP_URL || "https://client-chi-nine-98.vercel.app";
  return `${miniAppUrl.replace(/\/+$/, "")}/courier-login`;
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
  attachOptionalCourierAuth,
  asyncHandler(async (req, res) => {
    if (req.courierAuth) {
      const courier = await getCourierProfileByIdForPortal(req.courierAuth.courierId);
      res.json({ data: courier });
      return;
    }

    const telegramIdentity = resolveTelegramIdentity(req);
    const courier = await getCourierProfileByTelegramUserId(telegramIdentity.telegramUserId);
    res.json({ data: courier });
  })
);

router.get(
  "/me/orders",
  attachOptionalCourierAuth,
  asyncHandler(async (req, res) => {
    if (req.courierAuth) {
      const orders = await getCourierOrdersByIdForPortal(req.courierAuth.courierId);
      res.json({ data: orders });
      return;
    }

    const telegramIdentity = resolveTelegramIdentity(req);
    const orders = await getCourierAssignedOrdersByTelegramUserId(telegramIdentity.telegramUserId);
    res.json({ data: orders });
  })
);

router.patch(
  "/online",
  requireCourierAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateCourierOnlineStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      throw createAppError(400, "Kuryer online holati noto'g'ri.", parsed.error.flatten());
    }

    const courier = await updateCourierOnlineStatus(req.courierAuth.courierId, parsed.data.onlineStatus);

    res.json({
      message: "Kuryer online holati yangilandi.",
      data: courier
    });
  })
);

router.post(
  "/:courierId/login-access",
  asyncHandler(async (req, res) => {
    const { courierId } = req.params;

    if (!courierId) {
      throw createAppError(400, "Kuryer ID kiritilishi kerak.");
    }

    const loginAccess = await ensureCourierLoginCredentials(courierId);

    res.json({
      message: loginAccess.generated ? "Kuryer login ma'lumotlari yaratildi." : "Kuryer login ma'lumotlari tayyor.",
      data: loginAccess
    });
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

    if (parsed.data.status === "approved" && courier?.telegramUserId) {
      try {
        const { temporaryPassword } = await ensureCourierLoginCredentials(courier.id);
        const telegramResponse = await sendCourierApprovedLoginMessage({
          telegramUserId: courier.telegramUserId,
          temporaryPassword,
          loginUrl: getCourierLoginUrl() || DEFAULT_COURIER_LOGIN_URL
        });

        console.log("[telegram] courier approval login message sent", {
          courierId: courier.id,
          messageId: telegramResponse.messageId
        });
      } catch (telegramError) {
        console.error("[telegram] failed to send courier approval login message", {
          courierId: courier.id,
          reason: telegramError.message
        });
      }
    }

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
