import { Router } from "express";
import {
  getAdminAnalytics,
  getAdminCourierPerformance
} from "../services/adminAnalyticsService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const analytics = await getAdminAnalytics();
    res.json({ data: analytics });
  })
);

router.get(
  "/courier-performance",
  asyncHandler(async (_req, res) => {
    const performance = await getAdminCourierPerformance();
    res.json({ data: performance });
  })
);

export default router;