import { Router } from "express";
import { getCategories } from "../services/catalogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await getCategories();
    res.json({ data: categories });
  })
);

export default router;
