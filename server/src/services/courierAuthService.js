import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import {
  generateCourierTemporaryPassword,
  hashCourierPassword,
  signCourierAuthToken,
  verifyCourierPassword
} from "../utils/courierAuth.js";
import { getOrdersByCourierId } from "./orderService.js";
import {
  ensureCourierAuthSchemaReady,
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady,
  ensureCourierVehicleSchemaReady,
  isCourierAuthSchemaError,
  isCourierProfileSchemaError,
  isCourierSchemaError,
  isCourierVehicleSchemaError
} from "./courierSchemaService.js";

const AUTH_COURIER_SELECT_FIELDS = [
  "id",
  "telegram_user_id",
  "username",
  "full_name",
  "phone",
  "status",
  "is_active",
  "created_at",
  "updated_at",
  "transport_type",
  "online_status",
  "transport_color",
  "vehicle_brand",
  "plate_number",
  "password_hash"
].join(",");

function normalizePhone(value) {
  return String(value || "").trim();
}

function normalizeCourierRecord(courierRecord) {
  if (!courierRecord) {
    return null;
  }

  return {
    id: courierRecord.id,
    telegramUserId: Number(courierRecord.telegram_user_id),
    username: courierRecord.username || "",
    fullName: courierRecord.full_name,
    phone: courierRecord.phone || "",
    transportType: courierRecord.transport_type ?? null,
    transportColor: courierRecord.transport_color ?? null,
    vehicleBrand: courierRecord.vehicle_brand ?? null,
    plateNumber: courierRecord.plate_number ?? null,
    onlineStatus: courierRecord.online_status ?? "offline",
    status: courierRecord.status,
    isActive: Boolean(courierRecord.is_active),
    createdAt: courierRecord.created_at,
    updatedAt: courierRecord.updated_at
  };
}

async function ensureCourierAuthReady() {
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();
  await ensureCourierVehicleSchemaReady();
  await ensureCourierAuthSchemaReady();
}

async function getCourierAuthRecordById(courierId) {
  await ensureCourierAuthReady();

  const { data, error } = await supabase
    .from("couriers")
    .select(AUTH_COURIER_SELECT_FIELDS)
    .eq("id", courierId)
    .maybeSingle();

  if (error) {
    if (isCourierSchemaError(error) || isCourierProfileSchemaError(error) || isCourierVehicleSchemaError(error) || isCourierAuthSchemaError(error)) {
      throw createAppError(503, "Courier login sxemasi hali tayyor emas.", {
        code: error.code || "COURIER_AUTH_SCHEMA_NOT_READY",
        reason: error.message
      });
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  return data;
}

async function getCourierAuthRecordByPhone(phone) {
  await ensureCourierAuthReady();

  const normalizedPhone = normalizePhone(phone);
  const { data, error } = await supabase
    .from("couriers")
    .select(AUTH_COURIER_SELECT_FIELDS)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (error) {
    if (isCourierSchemaError(error) || isCourierProfileSchemaError(error) || isCourierVehicleSchemaError(error) || isCourierAuthSchemaError(error)) {
      throw createAppError(503, "Courier login sxemasi hali tayyor emas.", {
        code: error.code || "COURIER_AUTH_SCHEMA_NOT_READY",
        reason: error.message
      });
    }

    throw createAppError(500, "Telefon bo'yicha kuryerni topib bo'lmadi.", error);
  }

  return data;
}

async function updateCourierPasswordHash(courierId, passwordHash) {
  const { data, error } = await supabase
    .from("couriers")
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    })
    .eq("id", courierId)
    .select(AUTH_COURIER_SELECT_FIELDS)
    .single();

  if (error) {
    if (isCourierAuthSchemaError(error)) {
      throw createAppError(503, "Courier login maydonlari hali tayyor emas.", {
        code: "COURIER_AUTH_SCHEMA_NOT_READY",
        reason: error.message,
        migrationFile: "server/supabase/migrations/20260326_add_courier_auth_fields.sql"
      });
    }

    throw createAppError(500, "Kuryer parolini saqlab bo'lmadi.", error);
  }

  return data;
}

export async function ensureCourierLoginCredentials(courierId) {
  const courierRecord = await getCourierAuthRecordById(courierId);

  if (!courierRecord) {
    throw createAppError(404, "Kuryer topilmadi.", { courierId });
  }

  if (!courierRecord.phone) {
    throw createAppError(400, "Kuryer login uchun telefon raqami kiritilishi kerak.", {
      courierId,
      code: "COURIER_PHONE_REQUIRED"
    });
  }

  if (courierRecord.password_hash) {
    return {
      courier: normalizeCourierRecord(courierRecord),
      temporaryPassword: null,
      generated: false
    };
  }

  const temporaryPassword = generateCourierTemporaryPassword();
  const passwordHash = hashCourierPassword(temporaryPassword);
  const updatedCourier = await updateCourierPasswordHash(courierId, passwordHash);

  return {
    courier: normalizeCourierRecord(updatedCourier),
    temporaryPassword,
    generated: true
  };
}

export async function setCourierPassword(courierId, password) {
  const courierRecord = await getCourierAuthRecordById(courierId);

  if (!courierRecord) {
    throw createAppError(404, "Kuryer topilmadi.", { courierId });
  }

  if (!courierRecord.phone) {
    throw createAppError(400, "Kuryer login uchun telefon raqami kiritilishi kerak.", {
      courierId,
      code: "COURIER_PHONE_REQUIRED"
    });
  }

  const updatedCourier = await updateCourierPasswordHash(courierId, hashCourierPassword(password));
  return normalizeCourierRecord(updatedCourier);
}

export async function authenticateCourier({ phone, password }) {
  const courierRecord = await getCourierAuthRecordByPhone(phone);

  if (!courierRecord || !courierRecord.password_hash) {
    throw createAppError(401, "Telefon yoki parol noto'g'ri.");
  }

  const isPasswordValid = verifyCourierPassword(password, courierRecord.password_hash);

  if (!isPasswordValid) {
    throw createAppError(401, "Telefon yoki parol noto'g'ri.");
  }

  const courier = normalizeCourierRecord(courierRecord);
  const token = signCourierAuthToken({
    courierId: courier.id,
    phone: courier.phone
  });

  return {
    token,
    courier
  };
}

export async function getCourierProfileByIdForPortal(courierId) {
  const courierRecord = await getCourierAuthRecordById(courierId);
  return normalizeCourierRecord(courierRecord);
}

export async function getCourierOrdersByIdForPortal(courierId) {
  const courierRecord = await getCourierAuthRecordById(courierId);

  if (!courierRecord) {
    return [];
  }

  if (courierRecord.status === "blocked") {
    return [];
  }

  if (courierRecord.status !== "approved" || !courierRecord.is_active) {
    return [];
  }

  return getOrdersByCourierId(courierRecord.id);
}
