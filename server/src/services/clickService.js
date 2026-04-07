import { env } from "../config/env.js";
import { createAppError } from "../utils/appError.js";

const CLICK_PAYMENT_BASE_URL = "https://my.click.uz/services/pay";

function isPlaceholderValue(value) {
  return (
    value.includes("your-click-service-id")
    || value.includes("your-click-merchant-id")
    || value.includes("your-click-secret-key")
    || value.includes("your-click-return-url")
  );
}

function formatClickAmount(amount) {
  const normalizedAmount = Number(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createAppError(400, "Click to'lovi uchun summa noto'g'ri.");
  }

  return Number.isInteger(normalizedAmount)
    ? String(normalizedAmount)
    : normalizedAmount.toFixed(2);
}

export function ensureClickConfigReady() {
  const missingVariables = [
    ["CLICK_SERVICE_ID", env.clickServiceId],
    ["CLICK_MERCHANT_ID", env.clickMerchantId],
    ["CLICK_SECRET_KEY", env.clickSecretKey],
    ["CLICK_RETURN_URL", env.clickReturnUrl]
  ]
    .filter(([, value]) => !value || isPlaceholderValue(value))
    .map(([key]) => key);

  if (!missingVariables.length) {
    return true;
  }

  throw createAppError(
    503,
    "Click payment konfiguratsiyasi to'liq emas.",
    {
      envFile: "server/.env",
      requiredVariables: missingVariables
    }
  );
}

export function createClickPayment({ orderId, amount }) {
  ensureClickConfigReady();

  const params = new URLSearchParams({
    service_id: env.clickServiceId,
    merchant_id: env.clickMerchantId,
    amount: formatClickAmount(amount),
    transaction_param: orderId,
    return_url: env.clickReturnUrl
  });

  return `${CLICK_PAYMENT_BASE_URL}?${params.toString()}`;
}

export function validateClickWebhookPayload(payload = {}) {
  const orderId = String(payload.transaction_param || "").trim();
  const amount = Number(payload.amount);
  const serviceId = String(payload.service_id || "").trim();
  const merchantId = String(payload.merchant_id || "").trim();

  if (!orderId) {
    throw createAppError(400, "Click webhook transaction_param kiritilmagan.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createAppError(400, "Click webhook amount noto'g'ri.");
  }

  if (serviceId && env.clickServiceId && serviceId !== env.clickServiceId) {
    throw createAppError(400, "Click webhook service_id noto'g'ri.");
  }

  if (merchantId && env.clickMerchantId && merchantId !== env.clickMerchantId) {
    throw createAppError(400, "Click webhook merchant_id noto'g'ri.");
  }

  return {
    orderId,
    amount
  };
}
