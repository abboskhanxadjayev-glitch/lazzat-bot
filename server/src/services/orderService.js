import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
import { getDeliveryDetails } from "../utils/delivery.js";
import { getProductsByIds } from "./catalogService.js";
import { sendOrderNotification } from "./telegramService.js";

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
    throw createAppError(
      500,
      "Order delivery fields could not be saved into public.orders.",
      error
    );
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

async function getOrderRecordById(orderId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, phone, address, notes, total_amount, status, source, created_at, customer_lat, customer_lng, delivery_distance_km, delivery_fee, telegram_payload")
    .eq("id", orderId)
    .single();

  if (error) {
    throw createAppError(500, "Buyurtma tafsilotlarini yuklab bo'lmadi.", error);
  }

  if (!data) {
    throw createAppError(404, "Buyurtma topilmadi.", { orderId });
  }

  return data;
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

  console.log(
    `[orders] inserting Supabase order for ${payload.customerName} with ${items.length} item(s)`
  );
  console.log("[orders] delivery payload before insert", {
    customerLat: deliveryDetails.customerLat,
    customerLng: deliveryDetails.customerLng,
    deliveryDistanceKm: deliveryDetails.deliveryDistanceKm,
    deliveryFee: deliveryDetails.deliveryFee
  });

  const { data: order, error: orderError } = await insertOrder(
    buildOrderPayload(payload, subtotalAmount, deliveryDetails)
  );

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
    console.error(
      `[telegram] failed to send notification for order ${createdOrder.id}`,
      telegramError
    );
    throw createAppError(502, "Order saved but Telegram notification failed.", {
      orderId: createdOrder.id,
      reason: telegramError.message
    });
  }

  return createdOrder;
}

export async function getOrders() {
  ensureSupabaseReady();

  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, phone, address, notes, total_amount, status, source, created_at, customer_lat, customer_lng, delivery_distance_km, delivery_fee, telegram_payload")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw createAppError(500, "Buyurtmalarni yuklab bo'lmadi.", error);
  }

  const orderIds = data.map((order) => order.id);
  const itemsByOrderId = await getOrderItemsByOrderIds(orderIds);

  return data.map((order) => mapOrderRecord(order, itemsByOrderId.get(order.id) || []));
}

export async function getOrderById(orderId) {
  ensureSupabaseReady();

  const orderRecord = await getOrderRecordById(orderId);
  const itemsByOrderId = await getOrderItemsByOrderIds([orderId]);

  return mapOrderRecord(orderRecord, itemsByOrderId.get(orderId) || []);
}