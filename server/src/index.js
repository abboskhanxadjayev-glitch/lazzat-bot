import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { verifySupabaseConnection } from "./config/supabase.js";
import { logTelegramConfiguration } from "./services/telegramService.js";
import {
  registerTelegramBotWebhook,
  syncTelegramBotWebhook
} from "./services/telegramBotWebhookService.js";

async function startServer() {
  await registerTelegramBotWebhook(app);

  app.listen(env.port, async () => {
    console.log(`Lazzat API listening on http://localhost:${env.port}`);

    const supabaseStatus = await verifySupabaseConnection();

    if (!supabaseStatus.ok) {
      console.warn(`[supabase] order persistence unavailable: ${supabaseStatus.reason}`);
    }

    logTelegramConfiguration();

    try {
      const webhookStatus = await syncTelegramBotWebhook();

      if (!webhookStatus.enabled) {
        console.warn(`[telegram-bot] webhook inactive: ${webhookStatus.reason}`);
      }
    } catch (error) {
      console.error("[telegram-bot] webhook sync failed", error);
    }
  });
}

startServer().catch((error) => {
  console.error("API serverni ishga tushirib bo'lmadi:", error);
  process.exit(1);
});
