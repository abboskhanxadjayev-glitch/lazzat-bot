import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import { getDeliveryDetails } from "../utils/delivery.js";
import { getProductsByIds } from "./catalogService.js";
import {
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady,
  isCourierProfileSchemaError,
  isCourierSchemaError
} from "./courierSchemaService.js";
import { notifyOperatorStatusChanged } from "./operatorNotificationService.js";
import { sendOrderNotification } from "./telegramService.js";

const BASE_ORDER_SELECT_FIELDS = "id, customer_name, phone, address, notes, total_amount, status, source, created_at, customer_lat, customer_lng, delivery_distance_km, delivery_fee, telegram_payload";
const ENHANCED_ORDER_SELECT_FIELDS = `${BASE_ORDER_SELECT_FIELDS}, courier_id, assigned_at, courier:courier_id(id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at)`;
const ACTIVE_COURIER_ORDER_STATUSES = ["assigned", "accepted", "ready_for_delivery", "on_the_way"];

const ORDER_ASSIGNMENT_SCHEMA_TTL_MS = 60_000;
let orderAssignmentSchemaCache = {
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

function isOrderAssignmentSchemaError(error) {
  if (!error) {
    return false;
  }

  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  return (
    isCourierSchemaError(error) ||
    errorCode === "42703" ||
    errorCode === "PGRST200" ||
    errorMessage.includes("courier_id") ||
    errorMessage.includes("assigned_at") ||
    errorMessage.includes("relationship")
  );
}

function hasFreshOrderAssignmentSchemaCache() {
  return Date.now() - orderAssignmentSchemaCache.checkedAt < ORDER_ASSIGNMENT_SCHEMA_TTL_MS;
}

async function runOrderQuery(buildQuery) {
  if (orderAssignmentSchemaCache.available !== false || !hasFreshOrderAssignmentSchemaCache()) {
    const enhancedResult = await buildQuery(ENHANCED_ORDER_SELECT_FIELDS);

    if (!enhancedResult.error) {
      orderAssignmentSchemaCache = {
        available: true,
        checkedAt: Date.now()
      };
      return enhancedResult;
    }

    if (!isOrderAssignmentSchemaError(enhancedResult.error)) {
      return enhancedResult;
    }

    orderAssignmentSchemaCache = {
      available: false,
      checkedAt: Date.now()
    };
    console.warn("[orders] assignment schema not detected, falling back to legacy select", enhancedResult.error.message);
  }

  return buildQuery(BASE_ORDER_SELECT_FIELDS);
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

function buildOrderPayload(payload, subtotalAmount, deliveryDetails) {
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
    updatedAt: courierRecord.updated_at || null
  };
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
      courier
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

async function getCourierRecordById(courierId) {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at")
    .eq("id", courierId)
    .maybeSingle();

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

  const { data, error } = await supabase
    .from("couriers")
    .select("id, telegram_user_id, username, full_name, phone, status, is_active, online_status, created_at, updated_at")
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("online_status", "online");

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

function pickCourierForAssignment(couriers = []) {
  if (!couriers.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * couriers.length);
  return couriers[randomIndex] || null;
}

async function updateOrderAssignment(orderId, courierId, status, assignedAt) {
  const { error } = await supabase
    .from("orders")
    .update({
      courier_id: courierId,
      status,
      assigned_at: assignedAt
    })
    .eq("id", orderId);

  if (error) {
    if (isOrderAssignmentSchemaError(error)) {
      await ensureCourierSchemaReady();
    }

    throw createAppError(500, "Buyurtma biriktirish ma'lumotlarini saqlab bo'lmadi.", error);
  }
}

async function autoAssignOrder(orderId) {
  try {
    const candidateCouriers = await getEligibleCouriersForAssignment();
    const selectedCourier = pickCourierForAssignment(candidateCouriers);

    if (!selectedCourier) {
      console.log(`[orders] no approved online courier found for order ${orderId}; keeping pending status.`);
      return null;
    }

    await updateOrderAssignment(orderId, selectedCourier.id, "assigned", new Date().toISOString());
    console.log(`[orders] order ${orderId} auto-assigned to courier ${selectedCourier.id}`);
    return selectedCourier;
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

export async function createOrder(payload) {
  ensureSupabaseReady();

  const products = await getProductsByIds(payload.items.map((item) => item.productId));
  const items = normalizeItems(products, payload.items);
  const subtotalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryDetails = getDeliveryDetails(payload);

  if (
    typeof payload.totalAmount === "number" &&
    Math.abs(payload.totalAmount - (subtotalAmount + deliveryDetails.deliveryFee)) > 1
  ) {
    console.warn("[orders] client total differed from server calculation; server total was used.", {
      clientTotal: payload.totalAmount,
      serverTotal: subtotalAmount + deliveryDetails.deliveryFee
    });
  }

  console.log(`[orders] inserting Supabase order for ${payload.customerName} with ${items.length} item(s)`);
  console.log("[orders] delivery payload before insert", {
    customerLat: deliveryDetails.customerLat,
    customerLng: deliveryDetails.customerLng,
    deliveryDistanceKm: deliveryDetails.deliveryDistanceKm,
    deliveryFee: deliveryDetails.deliveryFee
  });

  const { data: order, error: orderError } = await insertOrder(buildOrderPayload(payload, subtotalAmount, deliveryDetails));

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

export async function assignCourierToOrder(orderId, courierId = null) {
  ensureSupabaseReady();
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();

  const currentOrder = await getOrderRecordById(orderId);
  let nextCourierId = null;
  let nextStatus = currentOrder.status;
  let nextAssignedAt = currentOrder.assigned_at || null;

  if (courierId) {
    const courierRecord = await getCourierRecordById(courierId);

    if (courierRecord.status !== "approved" || !courierRecord.is_active || courierRecord.online_status !== "online") {
      throw createAppError(400, "Faqat online va tasdiqlangan faol kuryerni biriktirish mumkin.", {
        courierId,
        status: courierRecord.status,
        isActive: courierRecord.is_active,
        onlineStatus: courierRecord.online_status
      });
    }

    nextCourierId = courierRecord.id;
    nextStatus = "assigned";
    nextAssignedAt = new Date().toISOString();
  } else {
    nextCourierId = null;
    nextAssignedAt = null;
    nextStatus = ["delivered", "cancelled"].includes(currentOrder.status) ? currentOrder.status : "pending";
  }

  await updateOrderAssignment(orderId, nextCourierId, nextStatus, nextAssignedAt);
  return getOrderById(orderId);
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

  await getOrderRecordById(orderId);
  await updateOrderRecordStatus(orderId, status);

  const updatedOrder = await getOrderById(orderId);

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