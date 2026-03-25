import { createHash } from "crypto";
import { env } from "../config/env.js";

const DEFAULT_MINI_APP_URL = "https://client-chi-nine-98.vercel.app";
const DEFAULT_PRODUCTION_WEBHOOK_BASE_URL = "https://lazzat-bot.onrender.com";

let botRuntime = null;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getBotToken() {
  return process.env.BOT_TOKEN || env.telegramBotToken || "";
}

function getMiniAppUrl() {
  return trimTrailingSlash(process.env.MINI_APP_URL || DEFAULT_MINI_APP_URL);
}

function getWebhookBaseUrl() {
  const configuredBaseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL
    || process.env.PUBLIC_BASE_URL
    || process.env.APP_BASE_URL
    || process.env.RENDER_EXTERNAL_URL
    || (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_WEBHOOK_BASE_URL : "");

  return configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : "";
}

function getWebhookSecret(token) {
  return process.env.TELEGRAM_WEBHOOK_SECRET
    || createHash("sha256").update(token).digest("hex").slice(0, 32);
}

const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";

export async function registerTelegramBotWebhook(app) {
  const token = getBotToken();

  if (!token) {
    console.warn("[telegram-bot] webhook disabled: TELEGRAM_BOT_TOKEN/BOT_TOKEN missing.");
    return null;
  }

  try {
    const { createBot, syncBotConfiguration } = await import("../../../bot/src/index.js");
    const webhookSecret = getWebhookSecret(token);
    const webhookPath = TELEGRAM_WEBHOOK_PATH;
    const bot = createBot({
      token,
      miniAppUrl: getMiniAppUrl()
    });

    app.post(webhookPath, async (req, res) => {
      const requestSecret = req.get("x-telegram-bot-api-secret-token") || "";

      if (requestSecret !== webhookSecret) {
        res.status(403).json({ message: "Telegram webhook secret is invalid." });
        return;
      }

      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({ message: "Telegram update payload is missing." });
        return;
      }

      try {
        await bot.handleUpdate(req.body, res);

        if (!res.headersSent) {
          res.status(200).json({ ok: true });
        }
      } catch (error) {
        console.error("[telegram-bot] webhook update error", error);

        if (!res.headersSent) {
          res.status(500).json({ message: "Telegram webhook handling failed." });
        }
      }
    });

    botRuntime = {
      bot,
      syncBotConfiguration,
      webhookSecret,
      webhookPath,
      webhookBaseUrl: getWebhookBaseUrl()
    };

    console.log(`[telegram-bot] webhook route registered at ${webhookPath}`);
    return botRuntime;
  } catch (error) {
    console.error("[telegram-bot] failed to register webhook route", error);
    return null;
  }
}

export async function syncTelegramBotWebhook() {
  if (!botRuntime) {
    return {
      enabled: false,
      reason: "route-not-registered"
    };
  }

  await botRuntime.syncBotConfiguration(botRuntime.bot);

  if (!botRuntime.webhookBaseUrl) {
    console.warn("[telegram-bot] webhook sync skipped: TELEGRAM_WEBHOOK_BASE_URL/RENDER_EXTERNAL_URL not available.");
    return {
      enabled: false,
      reason: "missing-public-base-url"
    };
  }

  const webhookUrl = `${botRuntime.webhookBaseUrl}${botRuntime.webhookPath}`;

  await botRuntime.bot.telegram.setWebhook(webhookUrl, {
    secret_token: botRuntime.webhookSecret,
    drop_pending_updates: false
  });

  console.log(`[telegram-bot] webhook synced to ${webhookUrl}`);

  return {
    enabled: true,
    webhookUrl
  };
}

export function getTelegramBotWebhookInfo() {
  if (!botRuntime) {
    return null;
  }

  return {
    webhookPath: botRuntime.webhookPath,
    webhookBaseUrl: botRuntime.webhookBaseUrl,
    hasWebhookSecret: Boolean(botRuntime.webhookSecret)
  };
}

