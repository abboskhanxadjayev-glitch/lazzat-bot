import { useCallback, useEffect, useMemo, useState } from "react";
import AdminOrderDetailCard from "../components/AdminOrderDetailCard";
import AdminOrderList from "../components/AdminOrderList";
import { STATUS_LABELS } from "../components/OrderStatusBadge";
import { getOrderById, getOrders, updateOrderStatus } from "../api/client";
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
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusValue, setStatusValue] = useState("pending");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const nextOrders = await getOrders();
      setOrders(nextOrders);
      setSelectedOrderId((currentId) => {
        if (currentId && nextOrders.some((order) => order.id === currentId)) {
          return currentId;
        }

        return nextOrders[0]?.id || "";
      });
    } catch (error) {
      console.error("[admin] orders load error", error);
      setOrdersError(error.message || "Buyurtmalarni yuklab bo'lmadi.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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

      const haystack = [order.customerName, order.phone, order.address]
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

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null);
      return;
    }

    let isActive = true;

    async function loadOrderDetail() {
      setDetailLoading(true);
      setDetailError("");
      setStatusMessage("");

      try {
        const order = await getOrderById(selectedOrderId);

        if (!isActive) {
          return;
        }

        setSelectedOrder(order);
        setStatusValue(order.status);
        setOrders((currentOrders) => currentOrders.map((currentOrder) => (
          currentOrder.id === order.id ? order : currentOrder
        )));
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("[admin] order detail load error", error);
        setDetailError(error.message || "Buyurtma tafsilotlarini yuklab bo'lmadi.");
      } finally {
        if (isActive) {
          setDetailLoading(false);
        }
      }
    }

    loadOrderDetail();

    return () => {
      isActive = false;
    };
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
      setSelectedOrder(updatedOrder);
      setStatusValue(updatedOrder.status);
      setOrders((currentOrders) => currentOrders.map((currentOrder) => (
        currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder
      )));
      setStatusMessage("Status muvaffaqiyatli yangilandi.");
    } catch (error) {
      console.error("[admin] status update error", error);
      setStatusMessage(error.message || "Statusni yangilab bo'lmadi.");
    } finally {
      setStatusSaving(false);
    }
  }, [selectedOrderId, statusValue]);

  return (
    <section className="space-y-5">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-label">Buyurtmalar ro'yxati</p>
                <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">Operator kuzatuvi</h2>
              </div>
              <button type="button" className="secondary-button" onClick={loadOrders}>
                Yangilash
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
              Telefon, manzil, summa va status bo'yicha buyurtmalarni tez ko'rib chiqing.
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
                  placeholder="Ism, telefon yoki manzil"
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

          {ordersLoading ? (
            <div className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">Buyurtmalar yuklanmoqda...</div>
          ) : null}

          {ordersError ? (
            <div className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {ordersError}
            </div>
          ) : null}

          {!ordersLoading && !ordersError ? (
            <AdminOrderList
              orders={filteredOrders}
              selectedOrderId={selectedOrderId}
              onSelect={handleSelectOrder}
            />
          ) : null}
        </section>

        <div className="space-y-4">
          {detailError ? (
            <div className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {detailError}
            </div>
          ) : null}

          {statusMessage ? (
            <div className={`surface-card rounded-[28px] p-5 text-sm ${statusMessage.includes("muvaffaqiyatli") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
              {statusMessage}
            </div>
          ) : null}

          <AdminOrderDetailCard
            order={selectedOrder}
            statusValue={statusValue}
            statusSaving={statusSaving}
            detailLoading={detailLoading}
            onStatusChange={setStatusValue}
            onStatusSubmit={handleStatusSubmit}
          />
        </div>
      </div>
    </section>
  );
}

export default AdminOrdersPage;