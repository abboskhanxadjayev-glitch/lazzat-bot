import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import { getOrdersByCourierId } from "./orderService.js";
import {
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady,
  ensureCourierVehicleSchemaReady,
  hasCourierProfileSchema,
  hasCourierVehicleSchema,
  isCourierProfileSchemaError,
  isCourierSchemaError,
  isCourierVehicleSchemaError
} from "./courierSchemaService.js";

const BASE_COURIER_SELECT_FIELDS = "id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at";
const PROFILE_COURIER_SELECT_FIELDS = `${BASE_COURIER_SELECT_FIELDS}, transport_type, online_status`;
const VEHICLE_COURIER_SELECT_FIELDS = `${PROFILE_COURIER_SELECT_FIELDS}, transport_color, vehicle_brand, plate_number`;
const COURIER_SELECT_CACHE_TTL_MS = 60_000;
const UZBEK_PLATE_PATTERN = /^(?:\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2}|\d{2}\s?\d{3}\s?[A-Z]{3})$/i;

let courierSelectCache = {
  profileAvailable: null,
  vehicleAvailable: null,
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

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizePlateNumber(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ").toUpperCase();
  return normalizedValue ? normalizedValue : null;
}

function requiresTransportDetails(transportType) {
  return ["bike", "moto", "car"].includes(transportType);
}

function requiresPlateNumber(transportType) {
  return transportType === "car";
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

function hasFreshCourierSelectCache() {
  return Date.now() - courierSelectCache.checkedAt < COURIER_SELECT_CACHE_TTL_MS;
}

function markCourierSelectCache(profileAvailable, vehicleAvailable) {
  courierSelectCache = {
    profileAvailable,
    vehicleAvailable,
    checkedAt: Date.now()
  };
}

async function runCourierQuery(buildQuery) {
  const shouldTryVehicleFields = courierSelectCache.vehicleAvailable !== false || !hasFreshCourierSelectCache();
  const shouldTryProfileFields = courierSelectCache.profileAvailable !== false || !hasFreshCourierSelectCache();

  if (shouldTryVehicleFields) {
    const vehicleResult = await buildQuery(VEHICLE_COURIER_SELECT_FIELDS);

    if (!vehicleResult.error) {
      markCourierSelectCache(true, true);
      return vehicleResult;
    }

    if (isCourierVehicleSchemaError(vehicleResult.error)) {
      markCourierSelectCache(true, false);
      console.warn("[couriers] vehicle fields not detected, falling back to profile select", vehicleResult.error.message);
    } else if (!isCourierProfileSchemaError(vehicleResult.error)) {
      return vehicleResult;
    } else {
      markCourierSelectCache(false, false);
      console.warn("[couriers] profile fields not detected, falling back to base select", vehicleResult.error.message);
    }
  }

  if (shouldTryProfileFields) {
    const profileResult = await buildQuery(PROFILE_COURIER_SELECT_FIELDS);

    if (!profileResult.error) {
      markCourierSelectCache(true, false);
      return profileResult;
    }

    if (!isCourierProfileSchemaError(profileResult.error)) {
      return profileResult;
    }

    markCourierSelectCache(false, false);
    console.warn("[couriers] profile fields not detected, falling back to base select", profileResult.error.message);
  }

  return buildQuery(BASE_COURIER_SELECT_FIELDS);
}

function buildMergedCourierProfile(existingCourier, payload) {
  const mergedProfile = {
    phone: payload.phone !== undefined ? payload.phone.trim() : (existingCourier?.phone || ""),
    transportType: payload.transportType !== undefined ? payload.transportType : (existingCourier?.transport_type ?? null),
    transportColor: payload.transportColor !== undefined
      ? normalizeOptionalText(payload.transportColor)
      : (existingCourier?.transport_color ?? null),
    vehicleBrand: payload.vehicleBrand !== undefined
      ? normalizeOptionalText(payload.vehicleBrand)
      : (existingCourier?.vehicle_brand ?? null),
    plateNumber: payload.plateNumber !== undefined
      ? normalizePlateNumber(payload.plateNumber)
      : (existingCourier?.plate_number ?? null)
  };

  if (mergedProfile.transportType === "foot") {
    mergedProfile.transportColor = null;
    mergedProfile.vehicleBrand = null;
    mergedProfile.plateNumber = null;
  }

  if (mergedProfile.transportType === "bike" || mergedProfile.transportType === "moto") {
    mergedProfile.plateNumber = null;
  }

  return mergedProfile;
}

function assertCourierProfileReadyForApproval(profile) {
  if (!profile.phone) {
    throw createAppError(400, "Kuryer telefon raqami kiritilishi kerak.", {
      code: "COURIER_PHONE_REQUIRED"
    });
  }

  if (!profile.transportType) {
    throw createAppError(400, "Kuryer transport turi tanlanishi kerak.", {
      code: "COURIER_TRANSPORT_REQUIRED"
    });
  }

  if (requiresTransportDetails(profile.transportType) && !profile.transportColor) {
    throw createAppError(400, "Transport rangi kiritilishi kerak.", {
      code: "COURIER_TRANSPORT_COLOR_REQUIRED",
      transportType: profile.transportType
    });
  }

  if (requiresTransportDetails(profile.transportType) && !profile.vehicleBrand) {
    throw createAppError(400, "Transport brendi yoki modeli kiritilishi kerak.", {
      code: "COURIER_VEHICLE_BRAND_REQUIRED",
      transportType: profile.transportType
    });
  }

  if (requiresPlateNumber(profile.transportType)) {
    if (!profile.plateNumber) {
      throw createAppError(400, "Avtomobil raqami kiritilishi kerak.", {
        code: "COURIER_PLATE_REQUIRED"
      });
    }

    if (!UZBEK_PLATE_PATTERN.test(profile.plateNumber)) {
      throw createAppError(400, "Avtomobil raqami noto'g'ri formatda. Masalan: 01 A 123 BC", {
        code: "COURIER_PLATE_INVALID",
        plateNumber: profile.plateNumber
      });
    }
  }
}

function isCourierProfileComplete(profile) {
  try {
    assertCourierProfileReadyForApproval(profile);
    return true;
  } catch {
    return false;
  }
}

function normalizeCourierRecord(courierRecord) {
  if (!courierRecord) {
    return null;
  }

  const phone = courierRecord.phone || "";
  const transportType = courierRecord.transport_type ?? null;
  const transportColor = courierRecord.transport_color ?? null;
  const vehicleBrand = courierRecord.vehicle_brand ?? null;
  const plateNumber = courierRecord.plate_number ?? null;
  const onlineStatus = courierRecord.online_status ?? "offline";

  return {
    id: courierRecord.id,
    telegramUserId: Number(courierRecord.telegram_user_id),
    username: courierRecord.username || "",
    fullName: courierRecord.full_name,
    phone,
    transportType,
    transportColor,
    vehicleBrand,
    plateNumber,
    onlineStatus,
    status: courierRecord.status,
    isActive: Boolean(courierRecord.is_active),
    isProfileComplete: isCourierProfileComplete({
      phone,
      transportType,
      transportColor,
      vehicleBrand,
      plateNumber
    }),
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

async function getCourierVehicleFieldsAvailable() {
  return hasCourierVehicleSchema();
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

async function insertOrUpdateCourier(existingCourier, payload, selectFields = VEHICLE_COURIER_SELECT_FIELDS) {
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

  if (isCourierVehicleSchemaError(response.error) && selectFields !== PROFILE_COURIER_SELECT_FIELDS) {
    markCourierSelectCache(true, false);
    return insertOrUpdateCourier(existingCourier, payload, PROFILE_COURIER_SELECT_FIELDS);
  }

  if (isCourierProfileSchemaError(response.error) && selectFields !== BASE_COURIER_SELECT_FIELDS) {
    markCourierSelectCache(false, false);
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
  const vehicleFieldsAvailable = profileFieldsAvailable ? await getCourierVehicleFieldsAvailable() : false;
  const mergedProfile = buildMergedCourierProfile(existingCourier, payload);
  const courierPayload = {
    ...buildCourierIdentityPayload({ existingCourier, telegramUser: payload.telegramUser, fullName }),
    phone: payload.phone.trim(),
    status: existingCourier?.status || "pending",
    is_active: existingCourier ? Boolean(existingCourier.is_active) : false
  };

  if (profileFieldsAvailable) {
    courierPayload.online_status = existingCourier?.online_status || "offline";
    courierPayload.transport_type = mergedProfile.transportType;
  }

  if (vehicleFieldsAvailable) {
    courierPayload.transport_color = mergedProfile.transportColor;
    courierPayload.vehicle_brand = mergedProfile.vehicleBrand;
    courierPayload.plate_number = mergedProfile.plateNumber;
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

  const touchesProfileFields = payload.transportType !== undefined || payload.submitForApproval === true;
  const touchesVehicleFields = payload.transportColor !== undefined || payload.vehicleBrand !== undefined || payload.plateNumber !== undefined;

  if (touchesProfileFields) {
    await ensureCourierProfileSchemaReady();
  }

  const mergedProfile = buildMergedCourierProfile(existingCourier, payload);
  const needsVehicleSchema = touchesVehicleFields || (payload.submitForApproval === true && requiresTransportDetails(mergedProfile.transportType));

  if (needsVehicleSchema) {
    await ensureCourierVehicleSchemaReady();
  }

  if (touchesProfileFields) {
    updatePayload.transport_type = mergedProfile.transportType;
  }

  if (touchesVehicleFields || payload.transportType !== undefined || payload.submitForApproval === true) {
    const vehicleSchemaAvailable = await getCourierVehicleFieldsAvailable();

    if (vehicleSchemaAvailable) {
      updatePayload.transport_color = mergedProfile.transportColor;
      updatePayload.vehicle_brand = mergedProfile.vehicleBrand;
      updatePayload.plate_number = mergedProfile.plateNumber;
    }
  }

  if (payload.submitForApproval) {
    assertCourierProfileReadyForApproval(mergedProfile);

    if (existingCourier.status !== "approved" && existingCourier.status !== "blocked") {
      updatePayload.status = "pending";
      updatePayload.is_active = false;
    }

    updatePayload.online_status = "offline";
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
