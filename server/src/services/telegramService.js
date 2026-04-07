import { env } from "../config/env.js";

let hasLoggedTelegramStatus = false;
const DEFAULT_COURIER_DASHBOARD_URL = "https://client-chi-nine-98.vercel.app/courier-dashboard";

function isPlaceholderValue(value) {
  return (
    value.includes("your-telegram-bot-token")
    || value.includes("your-telegram-chat-id")
    || value.includes("your-mini-app-url")
  );
}

function getTelegramConfig() {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || env.telegramBotToken || "";
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || env.telegramChatId || "";
  const hasTelegramNotifications = Boolean(
    telegramBotToken
    && telegramChatId
    && !isPlaceholderValue(telegramBotToken)
    && !isPlaceholderValue(telegramChatId)
  );

  return {
    telegramBotToken,
    telegramChatId,
    hasTelegramNotifications
  };
}

function buildItemsList(items) {
  return items.map((item) => `${item.productName} x${item.quantity}`).join(", ");
}

function formatTelegramMoney(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return String(Math.round(amount));
}

function getCourierDashboardUrl() {
  const configuredBaseUrl = (process.env.MINI_APP_URL || "").trim();

  if (configuredBaseUrl && !isPlaceholderValue(configuredBaseUrl)) {
    return `${configuredBaseUrl.replace(/\/+$/, "")}/courier-dashboard`;
  }

  return DEFAULT_COURIER_DASHBOARD_URL;
}

function buildInlineKeyboard(buttonRows = []) {
  const inlineKeyboard = buttonRows
    .map((row) => row.filter(Boolean).map((button) => ({
      text: button.text,
      url: button.url
    })))
    .filter((row) => row.length);

  if (!inlineKeyboard.length) {
    return undefined;
  }

  return {
    inline_keyboard: inlineKeyboard
  };
}

export function logTelegramConfiguration() {
  if (hasLoggedTelegramStatus) {
    return;
  }

  hasLoggedTelegramStatus = true;

  const { telegramChatId, telegramBotToken, hasTelegramNotifications } = getTelegramConfig();

  if (!telegramBotToken || isPlaceholderValue(telegramBotToken)) {
    console.warn("[telegram] bot token missing: fix server/.env TELEGRAM_BOT_TOKEN or BOT_TOKEN.");
    return;
  }

  if (!hasTelegramNotifications) {
    console.warn(
      "[telegram] notifications disabled: fix server/.env TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable order alerts."
    );
    return;
  }

  console.log(`[telegram] order notifications enabled for chat ${telegramChatId}`);
}

export async function sendTelegramMessage({ chatId, text, buttons = [] }) {
  const { telegramBotToken } = getTelegramConfig();

  if (!telegramBotToken || isPlaceholderValue(telegramBotToken)) {
    throw new Error("Telegram bot token is not configured.");
  }

  console.log("Sending Telegram message...");

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      reply_markup: buildInlineKeyboard(buttons)
    })
  });

  const responseText = await response.text();
  let result = null;

  try {
    result = JSON.parse(responseText);
  } catch {
    result = null;
  }

  console.log("[telegram] sendMessage response", {
    status: response.status,
    ok: result?.ok ?? false,
    body: result ?? responseText
  });

  if (!response.ok || !result?.ok) {
    const reason = result?.description || responseText || `HTTP ${response.status}`;
    throw new Error(`Telegram sendMessage failed: ${reason}`);
  }

  return {
    ok: true,
    messageId: result.result?.message_id ?? null,
    response: result
  };
}

export async function sendOrderNotification({ orderId, totalAmount, items }) {
  const { telegramChatId, hasTelegramNotifications } = getTelegramConfig();

  if (!hasTelegramNotifications) {
    throw new Error(
      "Telegram notifications are not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID."
    );
  }

  const message = [
    "\u{1F195} Yangi buyurtma",
    `ID: ${orderId}`,
    `Summa: ${formatTelegramMoney(totalAmount)}`,
    `Mahsulotlar: ${buildItemsList(items)}`
  ].join("\n");

  const telegramResponse = await sendTelegramMessage({
    chatId: telegramChatId,
    text: message
  });

  console.log(`[telegram] order ${orderId} notification sent successfully.`);

  return telegramResponse;
}

export async function sendCourierAssignmentNotification({ chatId, order }) {
  const mapUrl = order.customerLat !== null && order.customerLng !== null
    ? `https://maps.google.com/?q=${order.customerLat},${order.customerLng}`
    : null;
  const dashboardUrl = getCourierDashboardUrl();
  const paymentLabel = String(order.paymentMethod || "cash").toUpperCase();
  const distanceText = order.deliveryDistanceKm === null || order.deliveryDistanceKm === undefined
    ? "Noma'lum"
    : Number(order.deliveryDistanceKm).toFixed(2);
  const message = [
    "\u{1F680} Yangi buyurtma!",
    `Manzil: ${order.address}`,
    `Masofa: ${distanceText} km`,
    `Summa: ${formatTelegramMoney(order.totalAmount)} UZS`,
    `\u{1F4B3} Payment: ${paymentLabel}`,
    "",
    "\u{1F449} Panelni ochish:",
    dashboardUrl
  ].join("\n");

  const buttons = [[
    mapUrl ? { text: "Xaritada ochish", url: mapUrl } : null,
    { text: "Panelni ochish", url: dashboardUrl }
  ]];

  if (order.paymentMethod === "click" && order.paymentUrl) {
    buttons.push([
      { text: "\u{1F4B3} Pay via Click", url: order.paymentUrl }
    ]);
  }

  return sendTelegramMessage({
    chatId,
    text: message,
    buttons
  });
}

export async function sendCourierApprovedLoginMessage({ telegramUserId, temporaryPassword = null, loginUrl }) {
  const lines = [
    "\u2705 Siz tasdiqlandingiz.",
    "Kuryer panelga kirish uchun quyidagi linkdan foydalaning:",
    "",
    loginUrl
  ];

  if (temporaryPassword) {
    lines.push("", `Vaqtinchalik parol: ${temporaryPassword}`);
  }

  return sendTelegramMessage({
    chatId: telegramUserId,
    text: lines.join("\n")
  });
}
