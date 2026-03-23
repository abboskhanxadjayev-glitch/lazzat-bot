import { Router } from "express";
import { getProducts } from "../services/catalogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await getProducts({
      categoryId: req.query.categoryId,
      categorySlug: req.query.categorySlug
    });

    res.json({ data: products });
  })
);

export default router;
