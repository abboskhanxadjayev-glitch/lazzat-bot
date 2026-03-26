import { createHmac } from "crypto";
import { env } from "../config/env.js";
import { createAppError } from "./appError.js";

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTelegramUser(rawUser) {
  if (!rawUser?.id) {
    return null;
  }

  const telegramUserId = Number(rawUser.id);

  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    return null;
  }

  return {
    id: telegramUserId,
    username: rawUser.username || null,
    firstName: rawUser.first_name || rawUser.firstName || null,
    lastName: rawUser.last_name || rawUser.lastName || null
  };
}

function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[telegram-auth] failed to parse init data JSON", error);
    return null;
  }
}

function buildDataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) {
    return false;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";

  if (!hash) {
    return false;
  }

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const dataCheckString = buildDataCheckString(params);
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return expectedHash === hash;
}

export function parseTelegramInitData(initData) {
  if (!initData) {
    return {
      raw: "",
      user: null,
      authDate: null,
      startParam: "",
      isVerified: false
    };
  }

  const params = new URLSearchParams(initData);
  const rawUser = safeParseJson(params.get("user"));
  const telegramUser = normalizeTelegramUser(rawUser);
  const authDate = params.get("auth_date") || null;
  const startParam = params.get("start_param") || "";
  const botToken = process.env.BOT_TOKEN || env.telegramBotToken || "";

  return {
    raw: initData,
    user: telegramUser,
    authDate,
    startParam,
    isVerified: verifyTelegramInitData(initData, botToken)
  };
}

export function resolveTelegramIdentity(req, options = {}) {
  const { allowQueryFallback = true, fieldLabel = "Telegram user ID" } = options;
  const initData = getSingleValue(req.headers["x-telegram-init-data"]);
  const headerTelegramUserId = getSingleValue(req.headers["x-telegram-user-id"]);
  const queryTelegramUserId = allowQueryFallback
    ? getSingleValue(req.query.telegramUserId)
    : null;

  if (initData) {
    const parsedInitData = parseTelegramInitData(initData);

    if (parsedInitData.user?.id) {
      if (headerTelegramUserId && Number(headerTelegramUserId) !== parsedInitData.user.id) {
        console.warn("[telegram-auth] header Telegram user ID did not match initData user ID", {
          headerTelegramUserId,
          initDataTelegramUserId: parsedInitData.user.id
        });
      }

      return {
        telegramUserId: parsedInitData.user.id,
        telegramUser: parsedInitData.user,
        source: parsedInitData.isVerified ? "init-data-verified" : "init-data",
        initData: parsedInitData.raw,
        isVerified: parsedInitData.isVerified
      };
    }

    console.warn("[telegram-auth] initData header was provided but no Telegram user was found inside it");
  }

  const fallbackTelegramUserId = headerTelegramUserId || queryTelegramUserId;
  const normalizedFallbackUserId = Number(fallbackTelegramUserId);

  if (Number.isInteger(normalizedFallbackUserId) && normalizedFallbackUserId > 0) {
    return {
      telegramUserId: normalizedFallbackUserId,
      telegramUser: null,
      source: headerTelegramUserId ? "header" : "query",
      initData: initData || "",
      isVerified: false
    };
  }

  throw createAppError(400, `${fieldLabel} kiritilishi kerak.`);
}
