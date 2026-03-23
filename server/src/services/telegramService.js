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

  const { telegramChatId, hasTelegramNotifications } = getTelegramConfig();

  if (!hasTelegramNotifications) {
    console.warn(
      "[telegram] notifications disabled: fix server/.env TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable order alerts."
    );
    return;
  }

  console.log(`[telegram] order notifications enabled for chat ${telegramChatId}`);
}

export async function sendOrderNotification({ orderId, totalAmount, items }) {
  const { telegramBotToken, telegramChatId, hasTelegramNotifications } = getTelegramConfig();

  if (!hasTelegramNotifications) {
    throw new Error(
      "Telegram notifications are not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID."
    );
  }

  const message = [
    "\uD83C\uDD95 Yangi buyurtma",
    `ID: ${orderId}`,
    `Summa: ${totalAmount}`,
    `Mahsulotlar: ${buildItemsList(items)}`
  ].join("\n");

  console.log("Sending Telegram message...");

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: message
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

  console.log(`[telegram] order ${orderId} notification sent successfully.`);

  return {
    ok: true,
    messageId: result.result?.message_id ?? null,
    response: result
  };
}