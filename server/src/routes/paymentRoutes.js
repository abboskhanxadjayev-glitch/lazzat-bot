import { Router } from "express";
import { handleClickPaymentWebhook } from "../services/orderService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clickWebhookSchema } from "../utils/validation.js";

const router = Router();

router.post(
  "/click-webhook",
  asyncHandler(async (req, res) => {
    const parsedPayload = clickWebhookSchema.safeParse(req.body || {});

    if (!parsedPayload.success) {
      const firstIssue = parsedPayload.error.issues[0]?.message || "Webhook payload noto'g'ri.";
      console.error("[click] webhook validation failed", {
        reason: firstIssue,
        payload: req.body || {}
      });

      res.json({
        error: -1,
        error_note: firstIssue
      });
      return;
    }

    const result = await handleClickPaymentWebhook(parsedPayload.data);
    res.json(result);
  })
);

export default router;
