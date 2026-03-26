import { supabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { createAppError } from "../utils/appError.js";
import {
  ensureCourierProfileSchemaReady,
  ensureCourierSchemaReady
} from "./courierSchemaService.js";

const ACTIVE_ORDER_STATUSES = ["pending", "assigned", "accepted", "preparing", "ready_for_delivery", "on_the_way"];
const TODAY_TIME_ZONE = "Asia/Tashkent";

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

function getDayKey(dateValue) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TODAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));
}

function isSameBusinessDay(dateValue, currentDayKey) {
  if (!dateValue) {
    return false;
  }

  return getDayKey(dateValue) === currentDayKey;
}

function toMoney(value) {
  return Number(value || 0);
}

function toBoolean(value) {
  return Boolean(value);
}

function buildCourierPerformanceRows(couriers, orders, currentDayKey) {
  const rows = new Map(
    couriers.map((courier) => [courier.id, {
      courierId: courier.id,
      fullName: courier.full_name,
      phone: courier.phone || "",
      status: courier.status,
      isActive: toBoolean(courier.is_active),
      onlineStatus: courier.online_status || "offline",
      activeOrderCount: 0,
      deliveredOrdersToday: 0,
      totalDeliveredRevenueToday: 0
    }])
  );

  orders.forEach((order) => {
    if (!order.courier_id) {
      return;
    }

    const row = rows.get(order.courier_id);

    if (!row) {
      return;
    }

    if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
      row.activeOrderCount += 1;
    }

    if (order.status === "delivered" && isSameBusinessDay(order.created_at, currentDayKey)) {
      row.deliveredOrdersToday += 1;
      row.totalDeliveredRevenueToday += toMoney(order.total_amount);
    }
  });

  return Array.from(rows.values()).sort((left, right) => {
    if (right.activeOrderCount !== left.activeOrderCount) {
      return right.activeOrderCount - left.activeOrderCount;
    }

    if (right.deliveredOrdersToday !== left.deliveredOrdersToday) {
      return right.deliveredOrdersToday - left.deliveredOrdersToday;
    }

    return left.fullName.localeCompare(right.fullName, "uz");
  });
}

async function getAnalyticsOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status,total_amount,delivery_fee,courier_id,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw createAppError(500, "Analitika uchun buyurtmalarni yuklab bo'lmadi.", error);
  }

  return data || [];
}

async function getAnalyticsCouriers() {
  await ensureCourierSchemaReady();
  await ensureCourierProfileSchemaReady();

  const { data, error } = await supabase
    .from("couriers")
    .select("id, full_name, phone, status, is_active, online_status")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw createAppError(500, "Analitika uchun kuryerlarni yuklab bo'lmadi.", error);
  }

  return data || [];
}

export async function getAdminAnalytics() {
  ensureSupabaseReady();

  const [orders, couriers] = await Promise.all([
    getAnalyticsOrders(),
    getAnalyticsCouriers()
  ]);

  const currentDayKey = getDayKey(new Date());
  const todayOrders = orders.filter((order) => isSameBusinessDay(order.created_at, currentDayKey));
  const todayRevenue = todayOrders.reduce((sum, order) => sum + toMoney(order.total_amount), 0);
  const todayDeliveryFeeTotal = todayOrders.reduce((sum, order) => sum + toMoney(order.delivery_fee), 0);
  const activeOrderCount = orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)).length;
  const deliveredOrderCount = orders.filter((order) => order.status === "delivered").length;
  const approvedCouriers = couriers.filter((courier) => courier.status === "approved" && toBoolean(courier.is_active));
  const onlineCourierCount = approvedCouriers.filter((courier) => (courier.online_status || "offline") === "online").length;
  const offlineCourierCount = Math.max(approvedCouriers.length - onlineCourierCount, 0);
  const averageOrderValueToday = todayOrders.length ? todayRevenue / todayOrders.length : 0;
  const courierPerformance = buildCourierPerformanceRows(couriers, orders, currentDayKey);
  const topCourierTodayByDeliveredOrders = courierPerformance
    .filter((row) => row.deliveredOrdersToday > 0)
    .sort((left, right) => {
      if (right.deliveredOrdersToday !== left.deliveredOrdersToday) {
        return right.deliveredOrdersToday - left.deliveredOrdersToday;
      }

      return right.totalDeliveredRevenueToday - left.totalDeliveredRevenueToday;
    })[0] || null;
  const topCourierTodayByRevenue = courierPerformance
    .filter((row) => row.totalDeliveredRevenueToday > 0)
    .sort((left, right) => {
      if (right.totalDeliveredRevenueToday !== left.totalDeliveredRevenueToday) {
        return right.totalDeliveredRevenueToday - left.totalDeliveredRevenueToday;
      }

      return right.deliveredOrdersToday - left.deliveredOrdersToday;
    })[0] || null;

  return {
    todayOrderCount: todayOrders.length,
    todayRevenue,
    activeOrderCount,
    deliveredOrderCount,
    onlineCourierCount,
    offlineCourierCount,
    todayDeliveryFeeTotal,
    averageOrderValueToday,
    topCourierTodayByDeliveredOrders,
    topCourierTodayByRevenue,
    generatedAt: new Date().toISOString()
  };
}

export async function getAdminCourierPerformance() {
  ensureSupabaseReady();

  const [orders, couriers] = await Promise.all([
    getAnalyticsOrders(),
    getAnalyticsCouriers()
  ]);

  const currentDayKey = getDayKey(new Date());
  return buildCourierPerformanceRows(couriers, orders, currentDayKey);
}