import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assignCourierToOrder, updateOrderStatus } from "../api/client";
import AdminOrderDetailCard from "../components/AdminOrderDetailCard";
import AdminOrderList from "../components/AdminOrderList";
import LiveFeedStatus from "../components/LiveFeedStatus";
import { STATUS_LABELS } from "../components/OrderStatusBadge";
import { useAdminAnalytics } from "../hooks/useAdminAnalytics";
import { useLiveCouriers } from "../hooks/useLiveCouriers";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { formatCurrency } from "../utils/formatCurrency";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Barchasi" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

const COURIER_STATUS_LABELS = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  blocked: "Bloklangan"
};

const COURIER_STATUS_STYLES = {
  pending: "border-amber-200 bg-amber-100 text-amber-800",
  approved: "border-emerald-200 bg-emerald-100 text-emerald-800",
  blocked: "border-rose-200 bg-rose-100 text-rose-800"
};

const ONLINE_STATUS_STYLES = {
  online: "border-emerald-200 bg-emerald-100 text-emerald-800",
  offline: "border-slate-200 bg-slate-100 text-slate-700"
};

function PerformanceBadge({ label, tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tone}`}>
      {label}
    </span>
  );
}

function TopCourierCard({ title, courier, metricLabel, metricValue }) {
  return (
    <div className="surface-card rounded-[28px] p-5">
      <p className="section-label">{title}</p>
      {courier ? (
        <>
          <p className="mt-3 text-lg font-bold text-lazzat-maroon">{courier.fullName}</p>
          <p className="mt-1 text-sm text-lazzat-ink/60">{courier.phone || "Telefon yo'q"}</p>
          <p className="mt-3 text-sm font-semibold text-lazzat-maroon">
            {metricLabel}: {metricValue}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-lazzat-ink/60">Bugun hali yetkazilgan buyurtma yo'q.</p>
      )}
    </div>
  );
}

function AdminOrdersPage() {
  const {
    orders,
    isInitialLoading,
    errorMessage,
    lastUpdatedAt,
    liveMode,
    applyOrderPatch
  } = useLiveOrders();
  const {
    couriers,
    error: courierError,
    errorMessage: courierErrorMessage
  } = useLiveCouriers({
    channelKey: "admin-order-couriers"
  });
  const {
    analytics,
    courierPerformance,
    isInitialLoading: analyticsLoading,
    errorMessage: analyticsErrorMessage,
    lastUpdatedAt: analyticsLastUpdatedAt,
    liveMode: analyticsLiveMode
  } = useAdminAnalytics();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [statusValue, setStatusValue] = useState("pending");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const lastSelectedOrderIdRef = useRef("");
  const lastSyncedStatusRef = useRef(null);

  const combinedLastUpdatedAt = useMemo(() => {
    if (lastUpdatedAt && analyticsLastUpdatedAt) {
      return new Date(Math.max(lastUpdatedAt.getTime(), analyticsLastUpdatedAt.getTime()));
    }

    return lastUpdatedAt || analyticsLastUpdatedAt || null;
  }, [analyticsLastUpdatedAt, lastUpdatedAt]);

  const combinedLiveMode = liveMode === "realtime" ? liveMode : analyticsLiveMode;

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        order.customerName,
        order.phone,
        order.address,
        order.courier?.fullName,
        order.assignmentMethod === "auto" ? "auto" : order.assignmentMethod === "manual" ? "manual" : ""
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [orders, searchQuery, statusFilter]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId("");
      return;
    }

    if (!selectedOrderId || !filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrder) {
      lastSelectedOrderIdRef.current = "";
      lastSyncedStatusRef.current = null;
      setSelectedCourierId("");
      return;
    }

    const selectedOrderChanged = lastSelectedOrderIdRef.current !== selectedOrder.id;
    lastSelectedOrderIdRef.current = selectedOrder.id;

    setStatusValue((currentValue) => {
      const previousSyncedStatus = lastSyncedStatusRef.current;
      lastSyncedStatusRef.current = selectedOrder.status;

      if (selectedOrderChanged) {
        return selectedOrder.status;
      }

      if (
        previousSyncedStatus &&
        currentValue !== previousSyncedStatus &&
        currentValue !== selectedOrder.status
      ) {
        return currentValue;
      }

      return selectedOrder.status;
    });

    setSelectedCourierId(selectedOrder.courierId || "");
  }, [selectedOrder]);

  useEffect(() => {
    setStatusMessage("");
    setAssignmentMessage("");
  }, [selectedOrderId]);

  const approvedCouriers = useMemo(
    () => couriers.filter((courier) => courier.status === "approved" && courier.isActive && courier.onlineStatus === "online"),
    [couriers]
  );

  const courierSelectOptions = useMemo(() => {
    if (!selectedOrder?.courier) {
      return approvedCouriers;
    }

    const hasSelectedAssignedCourier = approvedCouriers.some((courier) => courier.id === selectedOrder.courier.id);

    if (hasSelectedAssignedCourier) {
      return approvedCouriers;
    }

    return [selectedOrder.courier, ...approvedCouriers];
  }, [approvedCouriers, selectedOrder]);

  const assignmentUnavailableReason = useMemo(() => {
    if (courierError?.details?.code === "COURIER_SCHEMA_NOT_READY") {
      return "Kuryer biriktirish uchun courier schema hali Supabase bazasiga qo'llanmagan.";
    }

    if (courierErrorMessage) {
      return courierErrorMessage;
    }

    return "";
  }, [courierError, courierErrorMessage]);

  const handleSelectOrder = useCallback((orderId) => {
    setSelectedOrderId(orderId);
  }, []);

  const handleStatusSubmit = useCallback(async () => {
    if (!selectedOrderId || !statusValue) {
      return;
    }

    setStatusSaving(true);
    setStatusMessage("");

    try {
      const updatedOrder = await updateOrderStatus(selectedOrderId, statusValue);
      applyOrderPatch(updatedOrder);
      setStatusValue(updatedOrder.status);
      lastSyncedStatusRef.current = updatedOrder.status;
      setStatusMessage(updatedOrder.status === "pending" && statusValue === "assigned"
        ? "Mos online kuryer topilmadi, buyurtma pending holatda qoldi."
        : "Status muvaffaqiyatli yangilandi.");
    } catch (requestError) {
      console.error("[admin] status update error", requestError);
      setStatusMessage(requestError.message || "Statusni yangilab bo'lmadi.");
    } finally {
      setStatusSaving(false);
    }
  }, [applyOrderPatch, selectedOrderId, statusValue]);

  const handleAssignCourier = useCallback(async () => {
    if (!selectedOrderId || !selectedCourierId) {
      return;
    }

    setAssignmentSaving(true);
    setAssignmentMessage("");

    try {
      const updatedOrder = await assignCourierToOrder(selectedOrderId, selectedCourierId);
      applyOrderPatch(updatedOrder);
      setSelectedCourierId(updatedOrder.courierId || "");
      setAssignmentMessage("Kuryer muvaffaqiyatli biriktirildi.");
    } catch (requestError) {
      console.error("[admin] courier assignment error", requestError);
      setAssignmentMessage(requestError.message || "Kuryerni biriktirib bo'lmadi.");
    } finally {
      setAssignmentSaving(false);
    }
  }, [applyOrderPatch, selectedCourierId, selectedOrderId]);

  const handleClearCourier = useCallback(async () => {
    if (!selectedOrderId) {
      return;
    }

    setAssignmentSaving(true);
    setAssignmentMessage("");

    try {
      const updatedOrder = await assignCourierToOrder(selectedOrderId, null);
      applyOrderPatch(updatedOrder);
      setSelectedCourierId("");
      setAssignmentMessage("Kuryer biriktirishi olib tashlandi.");
    } catch (requestError) {
      console.error("[admin] courier unassign error", requestError);
      setAssignmentMessage(requestError.message || "Kuryer biriktirishi olib tashlanmadi.");
    } finally {
      setAssignmentSaving(false);
    }
  }, [applyOrderPatch, selectedOrderId]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[28px] border border-emerald-200/70 bg-white/75 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">Jonli kuzatuv</p>
          <p className="mt-2 text-sm text-lazzat-ink/70">
            Analitika, buyurtmalar ro'yxati va kuryer yuklamasi avtomatik yangilanadi. Smart assignment eng yaqin online kuryerni tanlaydi.
          </p>
        </div>
        <LiveFeedStatus liveMode={combinedLiveMode} lastUpdatedAt={combinedLastUpdatedAt} />
      </div>

      {analyticsErrorMessage ? (
        <div className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {analyticsErrorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bugungi buyurtmalar</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{analytics.todayOrderCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bugungi aylanma</p>
          <p className="mt-3 text-2xl font-bold text-lazzat-maroon">{formatCurrency(analytics.todayRevenue)}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Faol buyurtmalar</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{analytics.activeOrderCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Yetkazilganlar</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{analytics.deliveredOrderCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Online kuryer</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{analytics.onlineCourierCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Offline kuryer</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{analytics.offlineCourierCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bugungi delivery fee</p>
          <p className="mt-3 text-2xl font-bold text-lazzat-maroon">{formatCurrency(analytics.todayDeliveryFeeTotal)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">O'rtacha buyurtma</p>
          <p className="mt-3 text-2xl font-bold text-lazzat-maroon">{formatCurrency(analytics.averageOrderValueToday)}</p>
          <p className="mt-2 text-sm text-lazzat-ink/60">Bugungi buyurtmalar bo'yicha o'rtacha qiymat.</p>
        </div>
        <TopCourierCard
          title="Eng faol kuryer"
          courier={analytics.topCourierTodayByDeliveredOrders}
          metricLabel="Yetkazilganlar"
          metricValue={analytics.topCourierTodayByDeliveredOrders ? analytics.topCourierTodayByDeliveredOrders.deliveredOrdersToday : 0}
        />
        <TopCourierCard
          title="Eng yuqori revenue"
          courier={analytics.topCourierTodayByRevenue}
          metricLabel="Revenue"
          metricValue={analytics.topCourierTodayByRevenue ? formatCurrency(analytics.topCourierTodayByRevenue.totalDeliveredRevenueToday) : formatCurrency(0)}
        />
      </div>

      <section className="surface-card rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label">Courier performance</p>
            <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">Bugungi yuklama va natijalar</h2>
            <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
              Online/offline holat, faol buyurtmalar soni va bugungi delivered revenue bo'yicha kuryerlar kesimini ko'ring.
            </p>
          </div>
          <p className="text-sm text-lazzat-ink/55">
            {analytics.generatedAt ? `Yangilandi: ${new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analytics.generatedAt))}` : "Yangilanmoqda..."}
          </p>
        </div>

        {analyticsLoading ? (
          <div className="mt-4 rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/50 p-4 text-sm text-lazzat-ink/65">
            Analitika yuklanmoqda...
          </div>
        ) : null}

        {!analyticsLoading && !courierPerformance.length ? (
          <div className="mt-4 rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/50 p-4 text-sm text-lazzat-ink/65">
            Hozircha kuryer performansi uchun ma'lumot yo'q.
          </div>
        ) : null}

        {!analyticsLoading && courierPerformance.length ? (
          <div className="mt-4 space-y-3">
            {courierPerformance.map((row) => (
              <div key={row.courierId} className="rounded-[24px] border border-lazzat-gold/15 bg-white/80 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-bold text-lazzat-maroon">{row.fullName}</p>
                    <p className="mt-1 text-sm text-lazzat-ink/60">{row.phone || "Telefon yo'q"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PerformanceBadge
                      label={COURIER_STATUS_LABELS[row.status] || row.status}
                      tone={COURIER_STATUS_STYLES[row.status] || COURIER_STATUS_STYLES.pending}
                    />
                    <PerformanceBadge
                      label={row.onlineStatus === "online" ? "Online" : "Offline"}
                      tone={ONLINE_STATUS_STYLES[row.onlineStatus] || ONLINE_STATUS_STYLES.offline}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-lazzat-gold/10 bg-lazzat-cream/60 px-4 py-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">Faol buyurtmalar</p>
                    <p className="mt-2 text-xl font-bold text-lazzat-maroon">{row.activeOrderCount}</p>
                  </div>
                  <div className="rounded-[20px] border border-lazzat-gold/10 bg-lazzat-cream/60 px-4 py-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">Bugun delivered</p>
                    <p className="mt-2 text-xl font-bold text-lazzat-maroon">{row.deliveredOrdersToday}</p>
                  </div>
                  <div className="rounded-[20px] border border-lazzat-gold/10 bg-lazzat-cream/60 px-4 py-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">Bugungi revenue</p>
                    <p className="mt-2 text-xl font-bold text-lazzat-maroon">{formatCurrency(row.totalDeliveredRevenueToday)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="surface-card rounded-[28px] p-5">
            <div>
              <p className="section-label">Buyurtmalar ro'yxati</p>
              <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">Operator kuzatuvi</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
              Telefon, manzil, summa, status, smart assignment usuli va biriktirilgan kuryer bo'yicha buyurtmalarni tez ko'rib chiqing.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
                  Qidirish
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Ism, telefon, manzil, kuryer, auto/manual"
                  className="field-input"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
                  Status filter
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="field-input"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-3 text-sm text-lazzat-ink/60">
              Topildi: <span className="font-bold text-lazzat-maroon">{filteredOrders.length}</span>
            </p>
          </div>

          {isInitialLoading ? (
            <div className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">Buyurtmalar yuklanmoqda...</div>
          ) : null}

          {errorMessage ? (
            <div className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {!isInitialLoading && !errorMessage ? (
            <AdminOrderList
              orders={filteredOrders}
              selectedOrderId={selectedOrderId}
              onSelect={handleSelectOrder}
            />
          ) : null}
        </section>

        <div className="space-y-4">
          {statusMessage ? (
            <div className={`surface-card rounded-[28px] p-5 text-sm ${statusMessage.includes("muvaffaqiyatli") || statusMessage.includes("pending") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
              {statusMessage}
            </div>
          ) : null}

          <AdminOrderDetailCard
            order={selectedOrder}
            statusValue={statusValue}
            statusSaving={statusSaving}
            detailLoading={false}
            onStatusChange={setStatusValue}
            onStatusSubmit={handleStatusSubmit}
            approvedCouriers={courierSelectOptions}
            courierValue={selectedCourierId}
            assignmentSaving={assignmentSaving}
            assignmentMessage={assignmentMessage}
            assignmentUnavailableReason={assignmentUnavailableReason}
            onCourierChange={setSelectedCourierId}
            onAssignCourier={handleAssignCourier}
            onClearCourier={handleClearCourier}
          />
        </div>
      </div>
    </section>
  );
}

export default AdminOrdersPage;