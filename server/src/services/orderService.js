import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { createAppError } from "../utils/appError.js";
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

export async function createOrder(payload) {
  ensureSupabaseReady();

  const products = await getProductsByIds(payload.items.map((item) => item.productId));
  const items = normalizeItems(products, payload.items);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const orderPayload = {
    customer_name: payload.customerName,
    phone: payload.phone,
    address: payload.address,
    notes: payload.notes || null,
    total_amount: totalAmount,
    status: "pending",
    source: "telegram_mini_app",
    telegram_payload: payload.telegramUser || null
  };

  console.log(
    `[orders] inserting Supabase order for ${payload.customerName} with ${items.length} item(s)`
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id, status, total_amount, created_at")
    .single();

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

  console.log(`[orders] Supabase order ${order.id} created successfully.`);

  const createdOrder = {
    id: order.id,
    status: order.status,
    totalAmount: Number(order.total_amount),
    createdAt: order.created_at,
    items
  };

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

  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, phone, address, total_amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw createAppError(500, "Buyurtmalarni yuklab bo'lmadi.", error);
  }

  return data.map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address,
    totalAmount: Number(order.total_amount),
    status: order.status,
    createdAt: order.created_at
  }));
}