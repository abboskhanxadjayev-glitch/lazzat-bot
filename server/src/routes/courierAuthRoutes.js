import { Router } from "express";
import { authenticateCourier } from "../services/courierAuthService.js";
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

export default router;
