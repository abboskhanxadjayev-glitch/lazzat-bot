import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import courierAuthRoutes from "./routes/courierAuthRoutes.js";
import courierRoutes from "./routes/courierRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import { registerTelegramBotWebhook } from "./services/telegramBotWebhookService.js";

const app = express();

const corsOrigin = env.corsOrigin === "*"
  ? true
  : env.corsOrigin.split(",").map((origin) => origin.trim());

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

await registerTelegramBotWebhook(app);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    supabaseEnabled: env.hasSupabase,
    supabaseConfigError: env.supabaseConfigError || null
  });
});

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/courier", courierAuthRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/couriers", courierRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: `Topilmadi: ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

export default app;
