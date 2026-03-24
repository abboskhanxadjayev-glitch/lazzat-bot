import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assignCourierToOrder, updateOrderStatus } from "../api/client";
import AdminOrderDetailCard from "../components/AdminOrderDetailCard";
import AdminOrderList from "../components/AdminOrderList";
import LiveFeedStatus from "../components/LiveFeedStatus";
import { STATUS_LABELS } from "../components/OrderStatusBadge";
import { useLiveCouriers } from "../hooks/useLiveCouriers";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { formatCurrency } from "../utils/formatCurrency";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Barchasi" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

function isSameLocalDay(dateValue, referenceDate) {
  const date = new Date(dateValue);

  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
    && date.getDate() === referenceDate.getDate()
  );
}

function AdminOrdersPage() {
  const {
    orders,
    isInitialLoading,
    error,
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

      const haystack = [order.customerName, order.phone, order.address, order.courier?.fullName]
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

  const stats = useMemo(() => {
    const today = new Date();
    const todayOrders = orders.filter((order) => isSameLocalDay(order.createdAt, today));
    const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    return {
      totalOrders: orders.length,
      pendingCount: orders.filter((order) => order.status === "pending").length,
      onTheWayCount: orders.filter((order) => order.status === "on_the_way").length,
      deliveredCount: orders.filter((order) => order.status === "delivered").length,
      todayOrders: todayOrders.length,
      todayRevenue
    };
  }, [orders]);

  const approvedCouriers = useMemo(
    () => couriers.filter((courier) => courier.status === "approved" && courier.isActive),
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
      setStatusMessage("Status muvaffaqiyatli yangilandi.");
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
            Buyurtmalar ro'yxati, hisoblagichlar va tafsilotlar avtomatik yangilanadi.
          </p>
        </div>
        <LiveFeedStatus liveMode={liveMode} lastUpdatedAt={lastUpdatedAt} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Jami buyurtma</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.totalOrders}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Kutilayotgan</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.pendingCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Yo'lda</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.onTheWayCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Yetkazildi</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.deliveredCount}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bugungi aylanma</p>
          <p className="mt-3 text-2xl font-bold text-lazzat-maroon">{formatCurrency(stats.todayRevenue)}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bugungi buyurtma</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.todayOrders}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="surface-card rounded-[28px] p-5">
            <div>
              <p className="section-label">Buyurtmalar ro'yxati</p>
              <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">Operator kuzatuvi</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
              Telefon, manzil, summa, status va biriktirilgan kuryer bo'yicha buyurtmalarni tez ko'rib chiqing.
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
                  placeholder="Ism, telefon, manzil yoki kuryer"
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
            <div className={`surface-card rounded-[28px] p-5 text-sm ${statusMessage.includes("muvaffaqiyatli") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
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

