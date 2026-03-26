import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";

const SCHEMA_CACHE_TTL_MS = 60_000;

let courierSchemaCache = {
  ready: null,
  checkedAt: 0,
  reason: ""
};

let courierProfileSchemaCache = {
  ready: null,
  checkedAt: 0,
  reason: ""
};

let courierVehicleSchemaCache = {
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

export const COURIER_PROFILE_SCHEMA_DETAILS = {
  code: "COURIER_PROFILE_SCHEMA_NOT_READY",
  migrationFile: "server/supabase/migrations/20260325_add_courier_profile_fields.sql",
  schemaFile: "server/supabase/schema.sql",
  requiredTables: ["public.couriers"],
  requiredColumns: ["public.couriers.transport_type", "public.couriers.online_status"]
};

export const COURIER_VEHICLE_SCHEMA_DETAILS = {
  code: "COURIER_VEHICLE_SCHEMA_NOT_READY",
  migrationFile: "server/supabase/migrations/20260325_add_courier_vehicle_fields.sql",
  schemaFile: "server/supabase/schema.sql",
  requiredTables: ["public.couriers"],
  requiredColumns: [
    "public.couriers.transport_color",
    "public.couriers.vehicle_brand",
    "public.couriers.plate_number"
  ]
};

function isSchemaCacheFresh(cache) {
  return Date.now() - cache.checkedAt < SCHEMA_CACHE_TTL_MS;
}

export function isCourierSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST205"
    || errorCode === "PGRST200"
    || errorMessage.includes("courier_id")
    || errorMessage.includes("assigned_at")
    || errorMessage.includes("public.couriers")
    || errorMessage.includes("relationship")
  );
}

export function isCourierProfileSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("transport_type")
    || errorMessage.includes("online_status")
  );
}

export function isCourierVehicleSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("transport_color")
    || errorMessage.includes("vehicle_brand")
    || errorMessage.includes("plate_number")
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

export function createCourierProfileSchemaNotReadyError(reason = "Courier profile fields are not ready yet.") {
  return createAppError(
    503,
    "Kuryer profil maydonlari hali tayyor emas. Yangi courier profile migratsiyasini Supabase bazasiga qo'llash kerak.",
    {
      ...COURIER_PROFILE_SCHEMA_DETAILS,
      reason
    }
  );
}

export function createCourierVehicleSchemaNotReadyError(reason = "Courier vehicle fields are not ready yet.") {
  return createAppError(
    503,
    "Kuryer transport maydonlari hali tayyor emas. Yangi courier vehicle migratsiyasini Supabase bazasiga qo'llash kerak.",
    {
      ...COURIER_VEHICLE_SCHEMA_DETAILS,
      reason
    }
  );
}

export async function ensureCourierSchemaReady() {
  if (courierSchemaCache.ready === true && isSchemaCacheFresh(courierSchemaCache)) {
    return true;
  }

  if (courierSchemaCache.ready === false && isSchemaCacheFresh(courierSchemaCache)) {
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

export async function ensureCourierProfileSchemaReady() {
  if (courierProfileSchemaCache.ready === true && isSchemaCacheFresh(courierProfileSchemaCache)) {
    return true;
  }

  if (courierProfileSchemaCache.ready === false && isSchemaCacheFresh(courierProfileSchemaCache)) {
    throw createCourierProfileSchemaNotReadyError(courierProfileSchemaCache.reason);
  }

  const profileColumnsCheck = await supabase
    .from("couriers")
    .select("id,transport_type,online_status")
    .limit(1);

  if (profileColumnsCheck.error) {
    if (isCourierProfileSchemaError(profileColumnsCheck.error)) {
      courierProfileSchemaCache = {
        ready: false,
        checkedAt: Date.now(),
        reason: profileColumnsCheck.error.message
      };
      throw createCourierProfileSchemaNotReadyError(profileColumnsCheck.error.message);
    }

    throw createAppError(500, "Courier profile schema tekshirib bo'lmadi.", profileColumnsCheck.error);
  }

  courierProfileSchemaCache = {
    ready: true,
    checkedAt: Date.now(),
    reason: "ready"
  };

  return true;
}

export async function ensureCourierVehicleSchemaReady() {
  if (courierVehicleSchemaCache.ready === true && isSchemaCacheFresh(courierVehicleSchemaCache)) {
    return true;
  }

  if (courierVehicleSchemaCache.ready === false && isSchemaCacheFresh(courierVehicleSchemaCache)) {
    throw createCourierVehicleSchemaNotReadyError(courierVehicleSchemaCache.reason);
  }

  const vehicleColumnsCheck = await supabase
    .from("couriers")
    .select("id,transport_color,vehicle_brand,plate_number")
    .limit(1);

  if (vehicleColumnsCheck.error) {
    if (isCourierVehicleSchemaError(vehicleColumnsCheck.error)) {
      courierVehicleSchemaCache = {
        ready: false,
        checkedAt: Date.now(),
        reason: vehicleColumnsCheck.error.message
      };
      throw createCourierVehicleSchemaNotReadyError(vehicleColumnsCheck.error.message);
    }

    throw createAppError(500, "Courier vehicle schema tekshirib bo'lmadi.", vehicleColumnsCheck.error);
  }

  courierVehicleSchemaCache = {
    ready: true,
    checkedAt: Date.now(),
    reason: "ready"
  };

  return true;
}

export async function hasCourierProfileSchema() {
  try {
    await ensureCourierProfileSchemaReady();
    return true;
  } catch (error) {
    if (error?.details?.code === COURIER_PROFILE_SCHEMA_DETAILS.code) {
      return false;
    }

    throw error;
  }
}

export async function hasCourierVehicleSchema() {
  try {
    await ensureCourierVehicleSchemaReady();
    return true;
  } catch (error) {
    if (error?.details?.code === COURIER_VEHICLE_SCHEMA_DETAILS.code) {
      return false;
    }

    throw error;
  }
}

export function resetCourierSchemaCache() {
  courierSchemaCache = {
    ready: null,
    checkedAt: 0,
    reason: ""
  };

  courierProfileSchemaCache = {
    ready: null,
    checkedAt: 0,
    reason: ""
  };

  courierVehicleSchemaCache = {
    ready: null,
    checkedAt: 0,
    reason: ""
  };
}
