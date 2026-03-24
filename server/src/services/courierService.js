import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import { getOrdersByCourierId } from "./orderService.js";
import { ensureCourierSchemaReady, isCourierSchemaError } from "./courierSchemaService.js";

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

function mapCourierRecord(courierRecord) {
  if (!courierRecord) {
    return null;
  }

  return {
    id: courierRecord.id,
    telegramUserId: Number(courierRecord.telegram_user_id),
    username: courierRecord.username || "",
    fullName: courierRecord.full_name,
    phone: courierRecord.phone || "",
    status: courierRecord.status,
    isActive: Boolean(courierRecord.is_active),
    createdAt: courierRecord.created_at,
    updatedAt: courierRecord.updated_at
  };
}

async function getCourierRecordById(courierId) {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
    .eq("id", courierId)
    .maybeSingle();

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  return data;
}

async function getCourierRecordByTelegramUserId(telegramUserId) {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  return data;
}

export async function getCouriers(status = null) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  let query = supabase
    .from("couriers")
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Kuryerlar ro'yxatini yuklab bo'lmadi.", error);
  }

  return (data || []).map(mapCourierRecord);
}

export async function registerCourier(payload) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const telegramUserId = normalizeTelegramUserId(payload.telegramUser.id);
  const existingCourier = await getCourierRecordByTelegramUserId(telegramUserId);
  const fullName = payload.fullName?.trim() || getFullNameFromTelegramUser(payload.telegramUser);
  const username = payload.telegramUser.username?.trim() || null;

  const courierPayload = {
    telegram_user_id: telegramUserId,
    username,
    full_name: fullName,
    phone: payload.phone.trim(),
    status: existingCourier?.status || "pending",
    is_active: existingCourier ? Boolean(existingCourier.is_active) : false,
    updated_at: new Date().toISOString()
  };

  let response;

  if (existingCourier) {
    response = await supabase
      .from("couriers")
      .update(courierPayload)
      .eq("id", existingCourier.id)
      .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
      .single();
  } else {
    response = await supabase
      .from("couriers")
      .insert(courierPayload)
      .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
      .single();
  }

  if (response.error || !response.data) {
    throw createAppError(500, "Kuryerni ro'yxatdan o'tkazib bo'lmadi.", response.error);
  }

  return mapCourierRecord(response.data);
}

export async function getCourierProfileByTelegramUserId(telegramUserId) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const normalizedTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const courierRecord = await getCourierRecordByTelegramUserId(normalizedTelegramUserId);

  return mapCourierRecord(courierRecord);
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
    throw createAppError(404, "Kuryer topilmadi.", { courierId });
  }

  const { data, error } = await supabase
    .from("couriers")
    .update({
      status,
      is_active: status === "approved",
      updated_at: new Date().toISOString()
    })
    .eq("id", courierId)
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    throw createAppError(500, "Kuryer statusini yangilab bo'lmadi.", error);
  }

  return mapCourierRecord(data);
}
