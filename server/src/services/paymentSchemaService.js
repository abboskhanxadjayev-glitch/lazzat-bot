import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";

const SCHEMA_CACHE_TTL_MS = 60_000;

let paymentSchemaCache = {
  ready: null,
  checkedAt: 0,
  reason: ""
};

export const PAYMENT_SCHEMA_DETAILS = {
  code: "ORDER_PAYMENT_SCHEMA_NOT_READY",
  migrationFile: "server/supabase/migrations/20260407_add_click_payment_fields.sql",
  schemaFile: "server/supabase/schema.sql",
  requiredTables: ["public.orders"],
  requiredColumns: ["public.orders.payment_method", "public.orders.payment_status"]
};

function isSchemaCacheFresh(cache) {
  return Date.now() - cache.checkedAt < SCHEMA_CACHE_TTL_MS;
}

export function isOrderPaymentSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("payment_method")
    || errorMessage.includes("payment_status")
  );
}

export function createPaymentSchemaNotReadyError(reason = "Order payment schema has not been applied yet.") {
  return createAppError(
    503,
    "To'lov maydonlari hali tayyor emas. Click payment migratsiyasini Supabase bazasiga qo'llash kerak.",
    {
      ...PAYMENT_SCHEMA_DETAILS,
      reason
    }
  );
}

export async function ensurePaymentSchemaReady() {
  if (paymentSchemaCache.ready === true && isSchemaCacheFresh(paymentSchemaCache)) {
    return true;
  }

  if (paymentSchemaCache.ready === false && isSchemaCacheFresh(paymentSchemaCache)) {
    throw createPaymentSchemaNotReadyError(paymentSchemaCache.reason);
  }

  const paymentColumnsCheck = await supabase
    .from("orders")
    .select("id,payment_method,payment_status")
    .limit(1);

  if (paymentColumnsCheck.error) {
    if (isOrderPaymentSchemaError(paymentColumnsCheck.error)) {
      paymentSchemaCache = {
        ready: false,
        checkedAt: Date.now(),
        reason: paymentColumnsCheck.error.message
      };
      throw createPaymentSchemaNotReadyError(paymentColumnsCheck.error.message);
    }

    throw createAppError(500, "Order payment schema tekshirib bo'lmadi.", paymentColumnsCheck.error);
  }

  paymentSchemaCache = {
    ready: true,
    checkedAt: Date.now(),
    reason: "ready"
  };

  return true;
}

export async function hasPaymentSchema() {
  try {
    await ensurePaymentSchemaReady();
    return true;
  } catch (error) {
    if (error?.details?.code === PAYMENT_SCHEMA_DETAILS.code) {
      return false;
    }

    throw error;
  }
}

export function resetPaymentSchemaCache() {
  paymentSchemaCache = {
    ready: null,
    checkedAt: 0,
    reason: ""
  };
}
