import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";

const SCHEMA_CACHE_TTL_MS = 60_000;

let courierSchemaCache = {
  ready: null,
  checkedAt: 0,
  reason: ""
};

export const COURIER_SCHEMA_DETAILS = {
  code: "COURIER_SCHEMA_NOT_READY",
  migrationFile: "server/supabase/migrations/20260325_add_courier_assignment.sql",
  schemaFile: "server/supabase/schema.sql",
  requiredTables: ["public.couriers"],
  requiredColumns: ["public.orders.courier_id", "public.orders.assigned_at"]
};

function isSchemaCacheFresh() {
  return Date.now() - courierSchemaCache.checkedAt < SCHEMA_CACHE_TTL_MS;
}

export function isCourierSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703" ||
    errorCode === "PGRST205" ||
    errorCode === "PGRST200" ||
    errorMessage.includes("courier_id") ||
    errorMessage.includes("assigned_at") ||
    errorMessage.includes("public.couriers") ||
    errorMessage.includes("relationship")
  );
}

export function createCourierSchemaNotReadyError(reason = "Courier schema has not been applied yet.") {
  return createAppError(
    503,
    "Kuryer tizimi hali tayyor emas. Courier schema avval Supabase bazasiga qo'llanishi kerak.",
    {
      ...COURIER_SCHEMA_DETAILS,
      reason
    }
  );
}

export async function ensureCourierSchemaReady() {
  if (courierSchemaCache.ready === true && isSchemaCacheFresh()) {
    return true;
  }

  if (courierSchemaCache.ready === false && isSchemaCacheFresh()) {
    throw createCourierSchemaNotReadyError(courierSchemaCache.reason);
  }

  const orderColumnsCheck = await supabase
    .from("orders")
    .select("id,courier_id,assigned_at")
    .limit(1);

  if (orderColumnsCheck.error) {
    if (isCourierSchemaError(orderColumnsCheck.error)) {
      courierSchemaCache = {
        ready: false,
        checkedAt: Date.now(),
        reason: orderColumnsCheck.error.message
      };
      throw createCourierSchemaNotReadyError(orderColumnsCheck.error.message);
    }

    throw createAppError(500, "Orders schema tekshirib bo'lmadi.", orderColumnsCheck.error);
  }

  const couriersTableCheck = await supabase
    .from("couriers")
    .select("id")
    .limit(1);

  if (couriersTableCheck.error) {
    if (isCourierSchemaError(couriersTableCheck.error)) {
      courierSchemaCache = {
        ready: false,
        checkedAt: Date.now(),
        reason: couriersTableCheck.error.message
      };
      throw createCourierSchemaNotReadyError(couriersTableCheck.error.message);
    }

    throw createAppError(500, "Couriers schema tekshirib bo'lmadi.", couriersTableCheck.error);
  }

  courierSchemaCache = {
    ready: true,
    checkedAt: Date.now(),
    reason: "ready"
  };

  return true;
}

export function resetCourierSchemaCache() {
  courierSchemaCache = {
    ready: null,
    checkedAt: 0,
    reason: ""
  };
}
