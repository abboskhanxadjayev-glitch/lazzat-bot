import { env } from "../config/env.js";

let hasLoggedTelegramStatus = false;

function isPlaceholderValue(value) {
  return value.includes("your-telegram-bot-token") || value.includes("your-telegram-chat-id");
}

function getTelegramConfig() {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || env.telegramBotToken || "";
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || env.telegramChatId || "";
  const hasTelegramNotifications = Boolean(
    telegramBotToken &&
    telegramChatId &&
    !isPlaceholderValue(telegramBotToken) &&
    !isPlaceholderValue(telegramChatId)
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

export async function sendTelegramMessage({ chatId, text }) {
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
      text
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
    "🆕 Yangi buyurtma",
    `ID: ${orderId}`,
    `Summa: ${totalAmount}`,
    `Mahsulotlar: ${buildItemsList(items)}`
  ].join("\n");

  const telegramResponse = await sendTelegramMessage({
    chatId: telegramChatId,
    text: message
  });

  console.log(`[telegram] order ${orderId} notification sent successfully.`);

  return telegramResponse;
}

export async function sendCourierApprovedLoginMessage({ telegramUserId, temporaryPassword = null, loginUrl }) {
  const lines = [
    "✅ Siz tasdiqlandingiz.",
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
