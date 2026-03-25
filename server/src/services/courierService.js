import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import { getOrdersByCourierId } from "./orderService.js";
import {
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady,
  hasCourierProfileSchema,
  isCourierProfileSchemaError,
  isCourierSchemaError
} from "./courierSchemaService.js";

const BASE_COURIER_SELECT_FIELDS = "id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at";
const ENHANCED_COURIER_SELECT_FIELDS = `${BASE_COURIER_SELECT_FIELDS}, transport_type, online_status`;
const COURIER_PROFILE_SCHEMA_TTL_MS = 60_000;

let courierProfileSelectCache = {
  available: null,
  checkedAt: 0
};

function ensureSupabaseReady() {
  if (supabase) {
    return;
  }

  throw createAppError(
    503,
    "Supabase order storage is not configured correctly.",
    {
      envFile: "server/.env",
      requiredVariables: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      reason: env.supabaseConfigError
    }
  );
}

function normalizeTelegramUserId(telegramUserId) {
  const parsedTelegramUserId = Number(telegramUserId);

  if (!Number.isInteger(parsedTelegramUserId) || parsedTelegramUserId <= 0) {
    throw createAppError(400, "Telegram user ID noto'g'ri yoki kiritilmagan.");
  }

  return parsedTelegramUserId;
}

function getFullNameFromTelegramUser(telegramUser) {
  const parts = [telegramUser.firstName, telegramUser.lastName]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(" ");
  }

  if (telegramUser.username) {
    return telegramUser.username;
  }

  return `Courier ${telegramUser.id}`;
}

function hasFreshCourierProfileSelectCache() {
  return Date.now() - courierProfileSelectCache.checkedAt < COURIER_PROFILE_SCHEMA_TTL_MS;
}

async function runCourierQuery(buildQuery) {
  if (courierProfileSelectCache.available !== false || !hasFreshCourierProfileSelectCache()) {
    const enhancedResult = await buildQuery(ENHANCED_COURIER_SELECT_FIELDS);

    if (!enhancedResult.error) {
      courierProfileSelectCache = {
        available: true,
        checkedAt: Date.now()
      };
      return enhancedResult;
    }

    if (!isCourierProfileSchemaError(enhancedResult.error)) {
      return enhancedResult;
    }

    courierProfileSelectCache = {
      available: false,
      checkedAt: Date.now()
    };

    console.warn("[couriers] extended profile fields not detected, falling back to base select", enhancedResult.error.message);
  }

  return buildQuery(BASE_COURIER_SELECT_FIELDS);
}

function normalizeCourierRecord(courierRecord) {
  if (!courierRecord) {
    return null;
  }

  const phone = courierRecord.phone || "";
  const transportType = courierRecord.transport_type ?? null;
  const onlineStatus = courierRecord.online_status ?? "offline";

  return {
    id: courierRecord.id,
    telegramUserId: Number(courierRecord.telegram_user_id),
    username: courierRecord.username || "",
    fullName: courierRecord.full_name,
    phone,
    transportType,
    onlineStatus,
    status: courierRecord.status,
    isActive: Boolean(courierRecord.is_active),
    isProfileComplete: Boolean(phone && transportType),
    createdAt: courierRecord.created_at,
    updatedAt: courierRecord.updated_at
  };
}

async function getCourierRecordById(courierId) {
  const { data, error } = await runCourierQuery((selectFields) => supabase
    .from("couriers")
    .select(selectFields)
    .eq("id", courierId)
    .maybeSingle());

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  return data;
}

async function getCourierRecordByTelegramUserId(telegramUserId) {
  const { data, error } = await runCourierQuery((selectFields) => supabase
    .from("couriers")
    .select(selectFields)
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle());

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  return data;
}

async function getCourierProfileFieldsAvailable() {
  return hasCourierProfileSchema();
}

function buildCourierIdentityPayload({ existingCourier, telegramUser, fullName }) {
  const payload = {
    full_name: existingCourier?.full_name || fullName,
    updated_at: new Date().toISOString()
  };

  if (telegramUser) {
    payload.telegram_user_id = normalizeTelegramUserId(telegramUser.id);
    payload.username = telegramUser.username?.trim() || null;
  } else if (existingCourier) {
    payload.username = existingCourier.username || null;
  }

  return payload;
}

async function insertOrUpdateCourier(existingCourier, payload, selectFields = ENHANCED_COURIER_SELECT_FIELDS) {
  let response;

  if (existingCourier) {
    response = await supabase
      .from("couriers")
      .update(payload)
      .eq("id", existingCourier.id)
      .select(selectFields)
      .single();
  } else {
    response = await supabase
      .from("couriers")
      .insert(payload)
      .select(selectFields)
      .single();
  }

  if (!response.error) {
    return response.data;
  }

  if (isCourierProfileSchemaError(response.error) && selectFields !== BASE_COURIER_SELECT_FIELDS) {
    courierProfileSelectCache = {
      available: false,
      checkedAt: Date.now()
    };

    return insertOrUpdateCourier(existingCourier, payload, BASE_COURIER_SELECT_FIELDS);
  }

  throw createAppError(500, "Kuryer ma'lumotlarini saqlab bo'lmadi.", response.error);
}

function throwCourierNotFound(courierId) {
  throw createAppError(404, "Kuryer topilmadi.", { courierId });
}

export async function getCouriers(status = null) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const { data, error } = await runCourierQuery((selectFields) => {
    let nextQuery = supabase
      .from("couriers")
      .select(selectFields)
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) {
      nextQuery = nextQuery.eq("status", status);
    }

    return nextQuery;
  });

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryerlar ro'yxatini yuklab bo'lmadi.", error);
  }

  return (data || []).map(normalizeCourierRecord);
}

export async function ensureCourierRegistrationRecord(payload) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const telegramUserId = normalizeTelegramUserId(payload.telegramUser.id);
  const existingCourier = await getCourierRecordByTelegramUserId(telegramUserId);
  const fullName = getFullNameFromTelegramUser(payload.telegramUser);
  const profileFieldsAvailable = await getCourierProfileFieldsAvailable();
  const courierPayload = {
    ...buildCourierIdentityPayload({ existingCourier, telegramUser: payload.telegramUser, fullName }),
    status: existingCourier?.status || "pending",
    is_active: existingCourier ? Boolean(existingCourier.is_active) : false
  };

  if (profileFieldsAvailable && !existingCourier) {
    courierPayload.online_status = "offline";
  }

  const courierRecord = await insertOrUpdateCourier(existingCourier, courierPayload);
  return normalizeCourierRecord(courierRecord);
}

export async function registerCourier(payload) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const telegramUserId = normalizeTelegramUserId(payload.telegramUser.id);
  const existingCourier = await getCourierRecordByTelegramUserId(telegramUserId);
  const fullName = payload.fullName?.trim() || getFullNameFromTelegramUser(payload.telegramUser);
  const profileFieldsAvailable = await getCourierProfileFieldsAvailable();
  const courierPayload = {
    ...buildCourierIdentityPayload({ existingCourier, telegramUser: payload.telegramUser, fullName }),
    phone: payload.phone.trim(),
    status: existingCourier?.status || "pending",
    is_active: existingCourier ? Boolean(existingCourier.is_active) : false
  };

  if (profileFieldsAvailable) {
    courierPayload.online_status = existingCourier?.online_status || "offline";
    if (payload.transportType !== undefined) {
      courierPayload.transport_type = payload.transportType || null;
    }
  }

  const courierRecord = await insertOrUpdateCourier(existingCourier, courierPayload);
  return normalizeCourierRecord(courierRecord);
}

export async function updateCourierProfile(courierId, payload) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const existingCourier = await getCourierRecordById(courierId);

  if (!existingCourier) {
    throwCourierNotFound(courierId);
  }

  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  if (payload.fullName !== undefined) {
    updatePayload.full_name = payload.fullName.trim();
  }

  if (payload.phone !== undefined) {
    updatePayload.phone = payload.phone.trim();
  }

  const wantsExtendedFields = payload.transportType !== undefined || payload.submitForApproval === true;

  if (wantsExtendedFields) {
    await ensureCourierProfileSchemaReady();

    if (payload.transportType !== undefined) {
      updatePayload.transport_type = payload.transportType;
    }

    if (payload.submitForApproval) {
      if (existingCourier.status !== "approved" && existingCourier.status !== "blocked") {
        updatePayload.status = "pending";
        updatePayload.is_active = false;
      }

      updatePayload.online_status = "offline";
    }
  }

  const courierRecord = await insertOrUpdateCourier(existingCourier, updatePayload);
  return normalizeCourierRecord(courierRecord);
}

export async function getCourierProfileByTelegramUserId(telegramUserId) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const normalizedTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const courierRecord = await getCourierRecordByTelegramUserId(normalizedTelegramUserId);

  return normalizeCourierRecord(courierRecord);
}

export async function getCourierAssignedOrdersByTelegramUserId(telegramUserId) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const normalizedTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const courierRecord = await getCourierRecordByTelegramUserId(normalizedTelegramUserId);

  if (!courierRecord) {
    return [];
  }

  if (courierRecord.status === "blocked") {
    throw createAppError(403, "Sizning kuryer profilingiz bloklangan.", {
      code: "COURIER_BLOCKED",
      courierStatus: courierRecord.status
    });
  }

  if (courierRecord.status !== "approved" || !courierRecord.is_active) {
    return [];
  }

  return getOrdersByCourierId(courierRecord.id);
}

export async function updateCourierStatus(courierId, status) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const existingCourier = await getCourierRecordById(courierId);

  if (!existingCourier) {
    throwCourierNotFound(courierId);
  }

  const profileFieldsAvailable = await getCourierProfileFieldsAvailable();
  const updatePayload = {
    status,
    is_active: status === "approved",
    updated_at: new Date().toISOString()
  };

  if (profileFieldsAvailable && status !== "approved") {
    updatePayload.online_status = "offline";
  }

  const courierRecord = await insertOrUpdateCourier(existingCourier, updatePayload);
  return normalizeCourierRecord(courierRecord);
}

export async function updateCourierOnlineStatus(courierId, onlineStatus) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();

  const existingCourier = await getCourierRecordById(courierId);

  if (!existingCourier) {
    throwCourierNotFound(courierId);
  }

  if (existingCourier.status === "blocked") {
    throw createAppError(403, "Bloklangan kuryer online holatini o'zgartira olmaydi.", {
      code: "COURIER_BLOCKED",
      courierStatus: existingCourier.status
    });
  }

  if (onlineStatus === "online" && (existingCourier.status !== "approved" || !existingCourier.is_active)) {
    throw createAppError(403, "Faqat tasdiqlangan kuryer online bo'la oladi.", {
      code: "COURIER_NOT_APPROVED",
      courierStatus: existingCourier.status,
      isActive: existingCourier.is_active
    });
  }

  const courierRecord = await insertOrUpdateCourier(existingCourier, {
    online_status: onlineStatus,
    updated_at: new Date().toISOString()
  });

  return normalizeCourierRecord(courierRecord);
}


