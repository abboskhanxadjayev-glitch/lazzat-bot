import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import {
  calculateDistanceKm,
  getDeliveryDetails,
  RESTAURANT_LOCATION,
  roundDistanceKm
} from "../utils/delivery.js";
import { getProductsByIds } from "./catalogService.js";
import { createClickPayment, ensureClickConfigReady, validateClickWebhookPayload } from "./clickService.js";
import {
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady,
  isCourierProfileSchemaError,
  isCourierSchemaError
} from "./courierSchemaService.js";
import { notifyOperatorStatusChanged } from "./operatorNotificationService.js";
import {
  createPaymentSchemaNotReadyError,
  ensurePaymentSchemaReady,
  isOrderPaymentSchemaError
} from "./paymentSchemaService.js";
import { sendCourierAssignmentNotification, sendOrderNotification } from "./telegramService.js";

const LEGACY_ORDER_SELECT_FIELDS = "id, customer_name, phone, address, notes, total_amount, status, source, created_at, customer_lat, customer_lng, delivery_distance_km, delivery_fee, telegram_payload";
const PAYMENT_ORDER_SELECT_FIELDS = `${LEGACY_ORDER_SELECT_FIELDS}, payment_method, payment_status`;
const LEGACY_RELATION_ORDER_SELECT_FIELDS = `${LEGACY_ORDER_SELECT_FIELDS}, courier_id, assigned_at, courier:courier_id(id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at)`;
const RELATION_ORDER_SELECT_FIELDS = `${PAYMENT_ORDER_SELECT_FIELDS}, courier_id, assigned_at, courier:courier_id(id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at)`;
const ENHANCED_ORDER_SELECT_FIELDS = `${RELATION_ORDER_SELECT_FIELDS}, assignment_method, assignment_distance_km`;
const COURIER_ASSIGNMENT_BASE_SELECT_FIELDS = "id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at";
const COURIER_ASSIGNMENT_LOCATION_SELECT_FIELDS = `${COURIER_ASSIGNMENT_BASE_SELECT_FIELDS}, base_latitude, base_longitude`;
const ACTIVE_COURIER_ORDER_STATUSES = ["assigned", "accepted", "ready_for_delivery", "on_the_way"];
const AUTO_ASSIGNMENT_ACTIVE_ORDER_STATUSES = ["assigned", "accepted", "preparing", "ready_for_delivery", "on_the_way"];

const ORDER_QUERY_SCHEMA_TTL_MS = 60_000;
const ORDER_ASSIGNMENT_METADATA_TTL_MS = 60_000;
const COURIER_ASSIGNMENT_LOCATION_TTL_MS = 60_000;

let orderQuerySchemaCache = {
  mode: null,
  checkedAt: 0
};

let orderAssignmentMetadataCache = {
  available: null,
  checkedAt: 0
};

let courierAssignmentLocationCache = {
  available: null,
  checkedAt: 0
};

function resetOrderQuerySchemaCache() {
  orderQuerySchemaCache = {
    mode: null,
    checkedAt: 0
  };
}

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

function hasFreshCache(checkedAt, ttlMs) {
  return Date.now() - checkedAt < ttlMs;
}

function isOrderRelationSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    isCourierSchemaError(error)
    || errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("courier_id")
    || errorMessage.includes("assigned_at")
    || errorMessage.includes("relationship")
  );
}

function isOrderAssignmentMetadataError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("assignment_method")
    || errorMessage.includes("assignment_distance_km")
  );
}

function isCourierAssignmentLocationError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    errorCode === "42703"
    || errorCode === "PGRST200"
    || errorMessage.includes("base_latitude")
    || errorMessage.includes("base_longitude")
  );
}

async function runOrderQuery(buildQuery) {
  const canReuseOrderQueryMode = hasFreshCache(orderQuerySchemaCache.checkedAt, ORDER_QUERY_SCHEMA_TTL_MS);
  const currentMode = canReuseOrderQueryMode ? orderQuerySchemaCache.mode : null;

  if (
    currentMode !== "relation_payment"
    && currentMode !== "relation_legacy"
    && currentMode !== "payment"
    && currentMode !== "legacy"
  ) {
    const enhancedResult = await buildQuery(ENHANCED_ORDER_SELECT_FIELDS);

    if (!enhancedResult.error) {
      orderQuerySchemaCache = {
        mode: "enhanced",
        checkedAt: Date.now()
      };
      return enhancedResult;
    }

    if (
      !isOrderRelationSchemaError(enhancedResult.error)
      && !isOrderAssignmentMetadataError(enhancedResult.error)
      && !isOrderPaymentSchemaError(enhancedResult.error)
    ) {
      return enhancedResult;
    }

    console.warn("[orders] enhanced order select unavailable, falling back", enhancedResult.error.message);
  }

  if (currentMode !== "relation_legacy" && currentMode !== "payment" && currentMode !== "legacy") {
    const relationResult = await buildQuery(RELATION_ORDER_SELECT_FIELDS);

    if (!relationResult.error) {
      orderQuerySchemaCache = {
        mode: "relation_payment",
        checkedAt: Date.now()
      };
      return relationResult;
    }

    if (!isOrderRelationSchemaError(relationResult.error) && !isOrderPaymentSchemaError(relationResult.error)) {
      return relationResult;
    }

    console.warn("[orders] payment-aware relation fields unavailable, falling back", relationResult.error.message);
  }

  if (currentMode !== "payment" && currentMode !== "legacy") {
    const legacyRelationResult = await buildQuery(LEGACY_RELATION_ORDER_SELECT_FIELDS);

    if (!legacyRelationResult.error) {
      orderQuerySchemaCache = {
        mode: "relation_legacy",
        checkedAt: Date.now()
      };
      return legacyRelationResult;
    }

    if (!isOrderRelationSchemaError(legacyRelationResult.error)) {
      return legacyRelationResult;
    }

    console.warn("[orders] legacy courier relation fields unavailable, falling back", legacyRelationResult.error.message);
  }

  if (currentMode !== "legacy") {
    const paymentResult = await buildQuery(PAYMENT_ORDER_SELECT_FIELDS);

    if (!paymentResult.error) {
      orderQuerySchemaCache = {
        mode: "payment",
        checkedAt: Date.now()
      };
      return paymentResult;
    }

    if (!isOrderPaymentSchemaError(paymentResult.error)) {
      return paymentResult;
    }

    console.warn("[orders] payment fields unavailable, falling back", paymentResult.error.message);
  }

  const legacyResult = await buildQuery(LEGACY_ORDER_SELECT_FIELDS);

  if (!legacyResult.error) {
    orderQuerySchemaCache = {
      mode: "legacy",
      checkedAt: Date.now()
    };
  }

  return legacyResult;
}

async function runCourierAssignmentQuery(buildQuery) {
  const canReuseLocationMode = hasFreshCache(courierAssignmentLocationCache.checkedAt, COURIER_ASSIGNMENT_LOCATION_TTL_MS);
  const shouldTryLocationFields = courierAssignmentLocationCache.available !== false || !canReuseLocationMode;

  if (shouldTryLocationFields) {
    const locationResult = await buildQuery(COURIER_ASSIGNMENT_LOCATION_SELECT_FIELDS);

    if (!locationResult.error) {
      courierAssignmentLocationCache = {
        available: true,
        checkedAt: Date.now()
      };
      return locationResult;
    }

    if (!isCourierAssignmentLocationError(locationResult.error)) {
      return locationResult;
    }

    courierAssignmentLocationCache = {
      available: false,
      checkedAt: Date.now()
    };
    console.warn("[couriers] assignment location fields unavailable, falling back", locationResult.error.message);
  }

  return buildQuery(COURIER_ASSIGNMENT_BASE_SELECT_FIELDS);
}

function normalizeItems(products, requestedItems) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return requestedItems.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw createAppError(400, `Mahsulot topilmadi: ${item.productId}`);
    }

    const unitPrice = Number(product.price);

    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity
    };
  });
}

function buildTelegramPayload(payload) {
  return {
    user: payload.telegramUser || null
  };
}

function buildBaseOrderPayload(payload, subtotalAmount, deliveryDetails) {
  return {
    customer_name: payload.customerName,
    phone: payload.phone,
    address: payload.address,
    notes: payload.notes || null,
    customer_lat: deliveryDetails.customerLat,
    customer_lng: deliveryDetails.customerLng,
    delivery_distance_km: deliveryDetails.deliveryDistanceKm,
    delivery_fee: deliveryDetails.deliveryFee,
    total_amount: subtotalAmount + deliveryDetails.deliveryFee,
    status: "pending",
    source: "telegram_mini_app",
    telegram_payload: buildTelegramPayload(payload)
  };
}

function buildOrderPayload(payload, subtotalAmount, deliveryDetails, includePaymentFields = true) {
  const basePayload = buildBaseOrderPayload(payload, subtotalAmount, deliveryDetails);

  if (!includePaymentFields) {
    return basePayload;
  }

  return {
    ...basePayload,
    payment_method: payload.paymentMethod || "cash",
    payment_status: "pending"
  };
}

function mapOrderItemRecord(item) {
  return {
    id: item.id || null,
    productId: item.product_id ?? item.productId ?? null,
    productName: item.product_name ?? item.productName,
    unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
    quantity: Number(item.quantity ?? 0),
    lineTotal: Number(item.line_total ?? item.lineTotal ?? 0)
  };
}

function mapCourierRecord(courierRecord) {
  if (!courierRecord) {
    return null;
  }

  const baseLatitude = courierRecord.base_latitude === undefined || courierRecord.base_latitude === null
    ? null
    : Number(courierRecord.base_latitude);
  const baseLongitude = courierRecord.base_longitude === undefined || courierRecord.base_longitude === null
    ? null
    : Number(courierRecord.base_longitude);

  return {
    id: courierRecord.id,
    telegramUserId: Number(courierRecord.telegram_user_id),
    username: courierRecord.username || "",
    fullName: courierRecord.full_name,
    phone: courierRecord.phone || "",
    onlineStatus: courierRecord.online_status || "offline",
    status: courierRecord.status,
    isActive: Boolean(courierRecord.is_active),
    createdAt: courierRecord.created_at || null,
    updatedAt: courierRecord.updated_at || null,
    baseLatitude,
    baseLongitude
  };
}

function buildAssignmentReason(assignmentMethod, assignmentDistanceKm) {
  if (assignmentMethod === "auto") {
    if (assignmentDistanceKm !== null && assignmentDistanceKm !== undefined) {
      return `Tizim eng yaqin online tasdiqlangan kuryerni ${Number(assignmentDistanceKm).toFixed(2)} km masofa bo'yicha tanladi. Teng holatda kamroq faol buyurtmali kuryer ustun bo'ladi.`;
    }

    return "Tizim online va tasdiqlangan kuryerlar orasidan kamroq faol buyurtmali kuryerni tanladi.";
  }

  if (assignmentMethod === "manual") {
    return "Buyurtma operator tomonidan qo'lda biriktirildi.";
  }

  return "";
}

function createClickPaymentUrlSafely(orderId, totalAmount, paymentMethod) {
  if (paymentMethod !== "click") {
    return null;
  }

  try {
    return createClickPayment({
      orderId,
      amount: totalAmount
    });
  } catch (error) {
    console.warn("[click] failed to build payment URL for order response", {
      orderId,
      reason: error.message
    });
    return null;
  }
}

function mapOrderRecord(orderRecord, orderItems = []) {
  const fallbackDelivery = orderRecord.telegram_payload?.delivery || null;
  const customerLat = orderRecord.customer_lat ?? fallbackDelivery?.customerLat ?? null;
  const customerLng = orderRecord.customer_lng ?? fallbackDelivery?.customerLng ?? null;
  const rawDistance = orderRecord.delivery_distance_km ?? fallbackDelivery?.deliveryDistanceKm;
  const rawDeliveryFee = orderRecord.delivery_fee ?? fallbackDelivery?.deliveryFee;
  const deliveryDistanceKm = rawDistance === null || rawDistance === undefined
    ? null
    : Number(rawDistance);
  const deliveryFee = rawDeliveryFee === null || rawDeliveryFee === undefined
    ? 0
    : Number(rawDeliveryFee);
  const items = orderItems.map(mapOrderItemRecord);
  const totalAmount = Number(orderRecord.total_amount);
  const subtotalAmount = items.length
    ? items.reduce((sum, item) => sum + item.lineTotal, 0)
    : Math.max(totalAmount - deliveryFee, 0);
  const notes = orderRecord.notes || "";
  const courier = mapCourierRecord(orderRecord.courier || null);
  const courierId = orderRecord.courier_id ?? courier?.id ?? null;
  const assignedAt = orderRecord.assigned_at ?? null;
  const assignmentMethod = orderRecord.assignment_method ?? null;
  const assignmentDistanceKm = orderRecord.assignment_distance_km === null || orderRecord.assignment_distance_km === undefined
    ? null
    : Number(orderRecord.assignment_distance_km);
  const assignmentReason = buildAssignmentReason(assignmentMethod, assignmentDistanceKm);
  const paymentMethod = orderRecord.payment_method || "cash";
  const paymentStatus = orderRecord.payment_status || "pending";
  const paymentUrl = createClickPaymentUrlSafely(orderRecord.id, totalAmount, paymentMethod);

  return {
    id: orderRecord.id,
    customerName: orderRecord.customer_name,
    phone: orderRecord.phone,
    address: orderRecord.address,
    notes,
    status: orderRecord.status,
    source: orderRecord.source || "telegram_mini_app",
    customerLat,
    customerLng,
    deliveryDistanceKm,
    deliveryFee,
    subtotalAmount,
    totalAmount,
    createdAt: orderRecord.created_at,
    items,
    courierId,
    assignedAt,
    courier,
    assignmentMethod,
    assignmentDistanceKm,
    paymentMethod,
    paymentStatus,
    paymentUrl,
    customer: {
      name: orderRecord.customer_name,
      phone: orderRecord.phone
    },
    pricing: {
      subtotalAmount,
      deliveryFee,
      totalAmount
    },
    delivery: {
      address: orderRecord.address,
      notes,
      distanceKm: deliveryDistanceKm,
      fee: deliveryFee,
      coordinates: {
        lat: customerLat,
        lng: customerLng
      }
    },
    assignment: {
      courierId,
      assignedAt,
      courier,
      method: assignmentMethod,
      distanceKm: assignmentDistanceKm,
      reason: assignmentReason
    },
    payment: {
      method: paymentMethod,
      status: paymentStatus,
      url: paymentUrl
    }
  };
}

async function insertOrder(orderPayload) {
  return supabase
    .from("orders")
    .insert(orderPayload)
    .select("id, status, total_amount, created_at")
    .single();
}

async function persistOrderDeliveryFields(orderId, deliveryDetails) {
  const { error } = await supabase
    .from("orders")
    .update({
      customer_lat: deliveryDetails.customerLat,
      customer_lng: deliveryDetails.customerLng,
      delivery_distance_km: deliveryDetails.deliveryDistanceKm,
      delivery_fee: deliveryDetails.deliveryFee
    })
    .eq("id", orderId);

  if (error) {
    console.error("[orders] failed to persist delivery columns", error);
    throw createAppError(500, "Order delivery fields could not be saved into public.orders.", error);
  }
}

async function getOrderItemsByOrderIds(orderIds = []) {
  if (!orderIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, product_name, unit_price, quantity, line_total, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw createAppError(500, "Buyurtma mahsulotlarini yuklab bo'lmadi.", error);
  }

  return data.reduce((map, item) => {
    const currentItems = map.get(item.order_id) || [];
    currentItems.push(item);
    map.set(item.order_id, currentItems);
    return map;
  }, new Map());
}

async function getMappedOrdersFromRecords(orderRecords = []) {
  const orderIds = orderRecords.map((order) => order.id);
  const itemsByOrderId = await getOrderItemsByOrderIds(orderIds);

  return orderRecords.map((order) => mapOrderRecord(order, itemsByOrderId.get(order.id) || []));
}

async function getOrderRecordById(orderId) {
  const { data, error } = await runOrderQuery((selectFields) => supabase
    .from("orders")
    .select(selectFields)
    .eq("id", orderId)
    .maybeSingle());

  if (error) {
    throw createAppError(500, "Buyurtma tafsilotlarini yuklab bo'lmadi.", error);
  }

  if (!data) {
    throw createAppError(404, "Buyurtma topilmadi.", { orderId });
  }

  return data;
}

async function updateOrderRecordStatus(orderId, status) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw createAppError(500, "Buyurtma statusini yangilab bo'lmadi.", error);
  }

  if (!data) {
    throw createAppError(404, "Buyurtma topilmadi.", { orderId });
  }

  return data;
}

async function updateOrderPaymentStatus(orderId, paymentStatus) {
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", orderId)
    .select("id, payment_status")
    .maybeSingle();

  if (error) {
    if (isOrderPaymentSchemaError(error)) {
      await ensurePaymentSchemaReady();
    }

    throw createAppError(500, "Buyurtma to'lov holatini yangilab bo'lmadi.", error);
  }

  if (!data) {
    throw createAppError(404, "Buyurtma topilmadi.", { orderId });
  }

  return data;
}

async function getCourierRecordById(courierId) {
  const { data, error } = await runCourierAssignmentQuery((selectFields) => supabase
    .from("couriers")
    .select(selectFields)
    .eq("id", courierId)
    .maybeSingle());

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    if (isCourierProfileSchemaError(error)) {
      await ensureCourierProfileSchemaReady();
    }

    throw createAppError(500, "Kuryer ma'lumotlarini yuklab bo'lmadi.", error);
  }

  if (!data) {
    throw createAppError(404, "Kuryer topilmadi.", { courierId });
  }

  return data;
}

async function getEligibleCouriersForAssignment() {
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();

  const { data, error } = await runCourierAssignmentQuery((selectFields) => supabase
    .from("couriers")
    .select(selectFields)
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("online_status", "online"));

  if (error) {
    if (isCourierSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    if (isCourierProfileSchemaError(error)) {
      await ensureCourierProfileSchemaReady();
    }

    throw createAppError(500, "Online kuryerlarni yuklab bo'lmadi.", error);
  }

  return data || [];
}

async function getActiveOrderCountByCourierIds(courierIds = []) {
  if (!courierIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("orders")
    .select("courier_id,status")
    .in("courier_id", courierIds)
    .in("status", AUTO_ASSIGNMENT_ACTIVE_ORDER_STATUSES);

  if (error) {
    throw createAppError(500, "Kuryer yuklamasini hisoblab bo'lmadi.", error);
  }

  return (data || []).reduce((map, item) => {
    const currentCount = map.get(item.courier_id) || 0;
    map.set(item.courier_id, currentCount + 1);
    return map;
  }, new Map());
}

function hasCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function getCourierOriginLocation(courierRecord) {
  if (hasCoordinates(courierRecord.base_latitude, courierRecord.base_longitude)) {
    return {
      latitude: Number(courierRecord.base_latitude),
      longitude: Number(courierRecord.base_longitude),
      source: "courier_base"
    };
  }

  return {
    latitude: RESTAURANT_LOCATION.latitude,
    longitude: RESTAURANT_LOCATION.longitude,
    source: "restaurant_fallback"
  };
}

function getOrderDestinationLocation(orderRecord) {
  if (!hasCoordinates(orderRecord.customer_lat, orderRecord.customer_lng)) {
    return null;
  }

  return {
    latitude: Number(orderRecord.customer_lat),
    longitude: Number(orderRecord.customer_lng)
  };
}

function calculateCourierDistanceToOrder(orderRecord, courierRecord) {
  const destination = getOrderDestinationLocation(orderRecord);

  if (!destination) {
    return null;
  }

  const origin = getCourierOriginLocation(courierRecord);
  return roundDistanceKm(calculateDistanceKm(origin, destination));
}

function rankCourierCandidates(orderRecord, couriers, activeOrderCounts) {
  return couriers
    .map((courier) => ({
      ...courier,
      activeOrderCount: activeOrderCounts.get(courier.id) || 0,
      assignmentDistanceKm: calculateCourierDistanceToOrder(orderRecord, courier),
      assignmentLocationSource: getCourierOriginLocation(courier).source
    }))
    .sort((left, right) => {
      const leftDistance = left.assignmentDistanceKm === null || left.assignmentDistanceKm === undefined
        ? Number.POSITIVE_INFINITY
        : Number(left.assignmentDistanceKm);
      const rightDistance = right.assignmentDistanceKm === null || right.assignmentDistanceKm === undefined
        ? Number.POSITIVE_INFINITY
        : Number(right.assignmentDistanceKm);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      if (left.activeOrderCount !== right.activeOrderCount) {
        return left.activeOrderCount - right.activeOrderCount;
      }

      return String(left.id).localeCompare(String(right.id));
    });
}

async function updateOrderAssignment(orderId, courierId, status, assignedAt, assignment = {}) {
  const assignmentMethod = assignment.method ?? null;
  const assignmentDistanceKm = assignment.distanceKm === null || assignment.distanceKm === undefined
    ? null
    : Number(assignment.distanceKm);
  const legacyPayload = {
    courier_id: courierId,
    status,
    assigned_at: assignedAt
  };
  const canTryMetadataWrite = orderAssignmentMetadataCache.available !== false
    || !hasFreshCache(orderAssignmentMetadataCache.checkedAt, ORDER_ASSIGNMENT_METADATA_TTL_MS);

  if (canTryMetadataWrite) {
    const { error } = await supabase
      .from("orders")
      .update({
        ...legacyPayload,
        assignment_method: assignmentMethod,
        assignment_distance_km: assignmentDistanceKm
      })
      .eq("id", orderId);

    if (!error) {
      orderAssignmentMetadataCache = {
        available: true,
        checkedAt: Date.now()
      };
      return;
    }

    if (!isOrderAssignmentMetadataError(error)) {
      if (isOrderRelationSchemaError(error)) {
        await ensureCourierSchemaReady();
      }

      throw createAppError(500, "Buyurtma biriktirish ma'lumotlarini saqlab bo'lmadi.", error);
    }

    orderAssignmentMetadataCache = {
      available: false,
      checkedAt: Date.now()
    };
    console.warn("[orders] assignment metadata columns unavailable, falling back to legacy assignment update", error.message);
  }

  const { error: legacyError } = await supabase
    .from("orders")
    .update(legacyPayload)
    .eq("id", orderId);

  if (legacyError) {
    if (isOrderRelationSchemaError(legacyError)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Buyurtma biriktirish ma'lumotlarini saqlab bo'lmadi.", legacyError);
  }
}

async function autoAssignOrder(orderId, currentOrderRecord = null) {
  try {
    const currentOrder = currentOrderRecord || await getOrderRecordById(orderId);

    if (currentOrder.courier_id && currentOrder.status === "assigned") {
      return getOrderById(orderId);
    }

    const candidateCouriers = await getEligibleCouriersForAssignment();

    if (!candidateCouriers.length) {
      console.log(`[orders] no approved online courier found for order ${orderId}; keeping pending status.`);
      return null;
    }

    const activeOrderCounts = await getActiveOrderCountByCourierIds(candidateCouriers.map((courier) => courier.id));
    const rankedCouriers = rankCourierCandidates(currentOrder, candidateCouriers, activeOrderCounts);
    const selectedCourier = rankedCouriers[0] || null;

    if (!selectedCourier) {
      console.log(`[orders] no ranked courier candidate found for order ${orderId}; keeping pending status.`);
      return null;
    }

    const assignedAt = new Date().toISOString();
    await updateOrderAssignment(orderId, selectedCourier.id, "assigned", assignedAt, {
      method: "auto",
      distanceKm: selectedCourier.assignmentDistanceKm
    });

    const updatedOrder = await getOrderById(orderId);
    await maybeNotifyCourierAssigned({
      previousOrder: currentOrder,
      nextOrder: updatedOrder,
      courierRecord: selectedCourier
    });

    console.log("[orders] order auto-assigned", {
      orderId,
      courierId: selectedCourier.id,
      assignmentDistanceKm: selectedCourier.assignmentDistanceKm,
      activeOrderCount: selectedCourier.activeOrderCount,
      locationSource: selectedCourier.assignmentLocationSource
    });

    return updatedOrder;
  } catch (error) {
    console.error("[orders] auto assignment failed; keeping order pending", error);
    return null;
  }
}

function ensureOrderAssignedToCourier(orderRecord, courierId) {
  if (!orderRecord.courier_id || orderRecord.courier_id !== courierId) {
    throw createAppError(403, "Bu buyurtma sizga biriktirilmagan.", {
      orderId: orderRecord.id,
      courierId
    });
  }
}

function normalizeTelegramUserId(telegramUserId) {
  const parsedTelegramUserId = Number(telegramUserId);

  if (!Number.isInteger(parsedTelegramUserId) || parsedTelegramUserId <= 0) {
    throw createAppError(400, "Telegram user ID noto'g'ri yoki kiritilmagan.");
  }

  return parsedTelegramUserId;
}

async function maybeNotifyCourierAssigned({ previousOrder = null, nextOrder, courierRecord = null }) {
  if (!nextOrder || nextOrder.status !== "assigned" || !nextOrder.courierId) {
    return null;
  }

  const previousCourierId = previousOrder?.courier_id ?? previousOrder?.courierId ?? null;
  const previousStatus = previousOrder?.status ?? null;
  const previousAssignedAt = previousOrder?.assigned_at ?? previousOrder?.assignedAt ?? null;

  if (
    previousStatus === "assigned"
    && previousCourierId === nextOrder.courierId
    && previousAssignedAt === nextOrder.assignedAt
  ) {
    return null;
  }

  const resolvedCourier = courierRecord
    ? mapCourierRecord(courierRecord)
    : (nextOrder.courier || mapCourierRecord(await getCourierRecordById(nextOrder.courierId)));

  if (!resolvedCourier?.telegramUserId) {
    console.warn(`[telegram] assigned courier ${nextOrder.courierId} has no telegram user id; skipping assignment notification.`);
    return null;
  }

  try {
    const telegramResponse = await sendCourierAssignmentNotification({
      chatId: resolvedCourier.telegramUserId,
      order: nextOrder
    });

    console.log("[telegram] courier assignment notification result", {
      orderId: nextOrder.id,
      courierId: nextOrder.courierId,
      messageId: telegramResponse.messageId
    });

    return telegramResponse;
  } catch (error) {
    console.error("[telegram] failed to send courier assignment notification", {
      orderId: nextOrder.id,
      courierId: nextOrder.courierId,
      reason: error.message
    });

    return null;
  }
}

export async function createOrder(payload) {
  ensureSupabaseReady();

  const products = await getProductsByIds(payload.items.map((item) => item.productId));
  const items = normalizeItems(products, payload.items);
  const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryDetails = getDeliveryDetails(payload);
  const totalAmount = subtotalAmount + deliveryDetails.deliveryFee;
  const wantsClickPayment = (payload.paymentMethod || "cash") === "click";

  if (
    typeof payload.totalAmount === "number" &&
    Math.abs(payload.totalAmount - totalAmount) > 1
  ) {
    console.warn("[orders] client total differed from server calculation; server total was used.", {
      clientTotal: payload.totalAmount,
      serverTotal: totalAmount
    });
  }

  if (wantsClickPayment) {
    ensureClickConfigReady();
    await ensurePaymentSchemaReady();
  }

  console.log(`[orders] inserting Supabase order for ${payload.customerName} with ${items.length} item(s)`);
  console.log("[orders] delivery payload before insert", {
    customerLat: deliveryDetails.customerLat,
    customerLng: deliveryDetails.customerLng,
    deliveryDistanceKm: deliveryDetails.deliveryDistanceKm,
    deliveryFee: deliveryDetails.deliveryFee
  });

  let orderInsertResult = await insertOrder(buildOrderPayload(payload, subtotalAmount, deliveryDetails, true));

  if (orderInsertResult.error && isOrderPaymentSchemaError(orderInsertResult.error)) {
    if (wantsClickPayment) {
      throw createPaymentSchemaNotReadyError(orderInsertResult.error.message);
    }

    console.warn("[orders] payment columns unavailable during insert, falling back to legacy order payload", orderInsertResult.error.message);
    orderInsertResult = await insertOrder(buildOrderPayload(payload, subtotalAmount, deliveryDetails, false));
  }

  const { data: order, error: orderError } = orderInsertResult;

  if (orderError || !order) {
    console.error("[orders] insert into orders failed", orderError);
    throw createAppError(500, "Supabase insert into orders failed.", orderError);
  }

  const orderItemsPayload = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    line_total: item.lineTotal
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

  if (itemsError) {
    console.error("[orders] insert into order_items failed", itemsError);
    await supabase.from("orders").delete().eq("id", order.id);
    throw createAppError(500, "Supabase insert into order_items failed.", itemsError);
  }

  await persistOrderDeliveryFields(order.id, deliveryDetails);
  await autoAssignOrder(order.id);

  console.log(`[orders] Supabase order ${order.id} created successfully with delivery columns.`);

  if (wantsClickPayment) {
    resetOrderQuerySchemaCache();
  }

  const storedOrder = await getOrderRecordById(order.id);
  const createdOrder = mapOrderRecord(storedOrder, items);

  try {
    const telegramResponse = await sendOrderNotification({
      orderId: createdOrder.id,
      totalAmount: createdOrder.totalAmount,
      items: createdOrder.items
    });

    console.log("[telegram] notification result", {
      orderId: createdOrder.id,
      messageId: telegramResponse.messageId
    });
  } catch (telegramError) {
    console.error(`[telegram] failed to send notification for order ${createdOrder.id}`, telegramError);
    throw createAppError(502, "Order saved but Telegram notification failed.", {
      orderId: createdOrder.id,
      reason: telegramError.message
    });
  }

  return createdOrder;
}

export async function getOrders() {
  ensureSupabaseReady();

  const { data, error } = await runOrderQuery((selectFields) => supabase
    .from("orders")
    .select(selectFields)
    .order("created_at", { ascending: false })
    .limit(100));

  if (error) {
    throw createAppError(500, "Buyurtmalarni yuklab bo'lmadi.", error);
  }

  return getMappedOrdersFromRecords(data || []);
}

export async function getOrdersByTelegramUserId(telegramUserId) {
  ensureSupabaseReady();

  const normalizedTelegramUserId = normalizeTelegramUserId(telegramUserId);
  const { data, error } = await runOrderQuery((selectFields) => supabase
    .from("orders")
    .select(selectFields)
    .contains("telegram_payload", { user: { id: normalizedTelegramUserId } })
    .order("created_at", { ascending: false })
    .limit(100));

  if (error) {
    throw createAppError(500, "Mijoz buyurtmalarini yuklab bo'lmadi.", error);
  }

  return getMappedOrdersFromRecords(data || []);
}

export async function getOrdersByCourierId(courierId) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();

  const { data, error } = await runOrderQuery((selectFields) => supabase
    .from("orders")
    .select(selectFields)
    .eq("courier_id", courierId)
    .in("status", ACTIVE_COURIER_ORDER_STATUSES)
    .order("created_at", { ascending: false })
    .limit(100));

  if (error) {
    throw createAppError(500, "Kuryer buyurtmalarini yuklab bo'lmadi.", error);
  }

  return getMappedOrdersFromRecords(data || []);
}

export async function getOrderById(orderId) {
  ensureSupabaseReady();

  const orderRecord = await getOrderRecordById(orderId);
  const itemsByOrderId = await getOrderItemsByOrderIds([orderId]);

  return mapOrderRecord(orderRecord, itemsByOrderId.get(orderId) || []);
}

export async function handleClickPaymentWebhook(webhookPayload = {}) {
  ensureSupabaseReady();
  ensureClickConfigReady();
  await ensurePaymentSchemaReady();
  resetOrderQuerySchemaCache();

  console.log("[click] webhook payload received", webhookPayload);

  let clickPayload;

  try {
    clickPayload = validateClickWebhookPayload(webhookPayload);
  } catch (error) {
    console.error("[click] invalid webhook payload", {
      reason: error.message,
      payload: webhookPayload
    });
    return {
      error: -1,
      error_note: error.message
    };
  }

  let orderRecord = null;

  try {
    orderRecord = await getOrderRecordById(clickPayload.orderId);
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        error: -5,
        error_note: "Order not found."
      };
    }

    throw error;
  }

  const paymentMethod = orderRecord.payment_method || "cash";
  const paymentStatus = orderRecord.payment_status || "pending";
  const expectedAmount = Number(orderRecord.total_amount || 0);

  if (Math.abs(expectedAmount - clickPayload.amount) > 0.01) {
    console.error("[click] webhook amount mismatch", {
      orderId: clickPayload.orderId,
      expectedAmount,
      receivedAmount: clickPayload.amount
    });

    return {
      error: -7,
      error_note: "Amount mismatch."
    };
  }

  if (paymentMethod !== "click") {
    return {
      error: -6,
      error_note: "Order payment method is not CLICK."
    };
  }

  if (paymentStatus === "paid") {
    console.log("[click] webhook ignored because order is already paid", {
      orderId: clickPayload.orderId
    });
    return { error: 0 };
  }

  await updateOrderPaymentStatus(clickPayload.orderId, "paid");

  console.log("[click] order payment marked as paid", {
    orderId: clickPayload.orderId,
    amount: clickPayload.amount
  });

  return { error: 0 };
}

export async function assignCourierToOrder(orderId, courierId = null) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();

  const currentOrder = await getOrderRecordById(orderId);
  let nextCourierId = null;
  let nextStatus = currentOrder.status;
  let nextAssignedAt = currentOrder.assigned_at || null;
  let courierRecord = null;
  let assignment = {
    method: null,
    distanceKm: null
  };

  if (courierId) {
    courierRecord = await getCourierRecordById(courierId);

    if (courierRecord.status !== "approved" || !courierRecord.is_active || courierRecord.online_status !== "online") {
      throw createAppError(400, "Faqat online va tasdiqlangan faol kuryerni biriktirish mumkin.", {
        courierId,
        status: courierRecord.status,
        isActive: courierRecord.is_active,
        onlineStatus: courierRecord.online_status
      });
    }

    if (currentOrder.courier_id === courierRecord.id && currentOrder.status === "assigned") {
      return getOrderById(orderId);
    }

    nextCourierId = courierRecord.id;
    nextStatus = "assigned";
    nextAssignedAt = new Date().toISOString();
    assignment = {
      method: "manual",
      distanceKm: calculateCourierDistanceToOrder(currentOrder, courierRecord)
    };
  } else {
    nextCourierId = null;
    nextAssignedAt = null;
    nextStatus = ["delivered", "cancelled"].includes(currentOrder.status) ? currentOrder.status : "pending";
  }

  await updateOrderAssignment(orderId, nextCourierId, nextStatus, nextAssignedAt, assignment);
  const updatedOrder = await getOrderById(orderId);

  if (courierRecord) {
    await maybeNotifyCourierAssigned({
      previousOrder: currentOrder,
      nextOrder: updatedOrder,
      courierRecord
    });
  }

  return updatedOrder;
}

export async function acceptCourierOrder(orderId, courierId) {
  ensureSupabaseReady();

  const orderRecord = await getOrderRecordById(orderId);
  ensureOrderAssignedToCourier(orderRecord, courierId);

  if (!["assigned", "ready_for_delivery"].includes(orderRecord.status)) {
    throw createAppError(400, "Faqat biriktirilgan buyurtmani qabul qilish mumkin.", {
      orderId,
      status: orderRecord.status
    });
  }

  await updateOrderRecordStatus(orderId, "accepted");
  return getOrderById(orderId);
}

export async function deliverCourierOrder(orderId, courierId) {
  ensureSupabaseReady();

  const orderRecord = await getOrderRecordById(orderId);
  ensureOrderAssignedToCourier(orderRecord, courierId);

  if (!["accepted", "on_the_way"].includes(orderRecord.status)) {
    throw createAppError(400, "Faqat qabul qilingan buyurtmani yetkazildi qilish mumkin.", {
      orderId,
      status: orderRecord.status
    });
  }

  await updateOrderRecordStatus(orderId, "delivered");
  return getOrderById(orderId);
}

export async function updateOrderStatus(orderId, status) {
  ensureSupabaseReady();

  const currentOrder = await getOrderRecordById(orderId);

  if (status === "assigned" && !currentOrder.courier_id) {
    const autoAssignedOrder = await autoAssignOrder(orderId, currentOrder);

    if (autoAssignedOrder) {
      try {
        await notifyOperatorStatusChanged({
          orderId,
          status: autoAssignedOrder.status,
          order: autoAssignedOrder
        });
      } catch (notificationError) {
        console.error("[operator-notifications] status hook failed", notificationError);
      }

      return autoAssignedOrder;
    }

    const fallbackOrder = currentOrder.status === "pending"
      ? await getOrderById(orderId)
      : (await updateOrderRecordStatus(orderId, "pending"), await getOrderById(orderId));

    try {
      await notifyOperatorStatusChanged({
        orderId,
        status: fallbackOrder.status,
        order: fallbackOrder
      });
    } catch (notificationError) {
      console.error("[operator-notifications] status hook failed", notificationError);
    }

    return fallbackOrder;
  }

  await updateOrderRecordStatus(orderId, status);

  const updatedOrder = await getOrderById(orderId);

  if (status === "assigned" && updatedOrder.courierId) {
    await maybeNotifyCourierAssigned({
      previousOrder: currentOrder,
      nextOrder: updatedOrder
    });
  }

  try {
    await notifyOperatorStatusChanged({
      orderId,
      status,
      order: updatedOrder
    });
  } catch (notificationError) {
    console.error("[operator-notifications] status hook failed", notificationError);
  }

  return updatedOrder;
}
