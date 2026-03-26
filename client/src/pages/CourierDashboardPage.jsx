import { useCallback, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  acceptCourierOrder,
  deliverCourierOrder,
  getCourierAssignedOrders,
  getCourierPortalProfile,
  updateCourierPortalOnlineStatus
} from "../api/client";
import LiveFeedStatus from "../components/LiveFeedStatus";
import OrderStatusBadge from "../components/OrderStatusBadge";
import PageHeader from "../components/PageHeader";
import { useLiveCourierProfile } from "../hooks/useLiveCourierProfile";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { useCourierSession } from "../hooks/useCourierSession";
import { formatCurrency } from "../utils/formatCurrency";

function formatDistance(value) {
  if (value === null || value === undefined) {
    return "Noma'lum";
  }

  return `${Number(value).toFixed(2)} km`;
}

function formatCoordinate(value) {
  if (value === null || value === undefined || value === "") {
    return "Noma'lum";
  }

  return Number(value).toFixed(6);
}

function formatDate(value) {
  if (!value) {
    return "Noma'lum";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTransportLabel(courier) {
  const parts = [courier.transportType || "Transport yo'q"];

  if (courier.transportColor) {
    parts.push(courier.transportColor);
  }

  if (courier.vehicleBrand) {
    parts.push(courier.vehicleBrand);
  }

  if (courier.plateNumber) {
    parts.push(courier.plateNumber);
  }

  return parts.join(" - ");
}

function CourierDashboardPage() {
  const { token, isAuthenticated, clearSession } = useCourierSession();
  const [activeOrderId, setActiveOrderId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [onlineSaving, setOnlineSaving] = useState(false);

  const handleUnauthorized = useCallback((error) => {
    if (error?.statusCode === 401) {
      clearSession();
      return true;
    }

    return false;
  }, [clearSession]);

  const fetchCourierProfile = useCallback(async ({ signal }) => {
    try {
      return await getCourierPortalProfile(token, { signal });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return null;
      }

      throw error;
    }
  }, [handleUnauthorized, token]);

  const fetchCourierOrders = useCallback(async ({ signal }) => {
    try {
      return await getCourierAssignedOrders(token, { signal });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return [];
      }

      throw error;
    }
  }, [handleUnauthorized, token]);

  const {
    courier,
    isInitialLoading: courierLoading,
    errorMessage: courierErrorMessage,
    lastUpdatedAt: courierLastUpdatedAt,
    liveMode: courierLiveMode,
    setCourierProfile
  } = useLiveCourierProfile({
    fetchCourier: isAuthenticated ? fetchCourierProfile : null,
    enabled: isAuthenticated,
    channelKey: "courier-dashboard-profile"
  });

  const {
    orders,
    isInitialLoading: ordersLoading,
    errorMessage: ordersErrorMessage,
    lastUpdatedAt: ordersLastUpdatedAt,
    liveMode: ordersLiveMode,
    applyOrderPatch
  } = useLiveOrders({
    fetchOrders: fetchCourierOrders,
    enabled: Boolean(isAuthenticated && token),
    channelKey: "courier-dashboard-orders"
  });

  const activeOrders = useMemo(
    () => orders.filter((order) => ["assigned", "accepted", "ready_for_delivery", "on_the_way"].includes(order.status)),
    [orders]
  );

  const summary = useMemo(() => ({
    orderCount: activeOrders.length,
    totalAmount: activeOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  }), [activeOrders]);

  const handleOnlineToggle = useCallback(async (nextOnlineStatus) => {
    if (!courier) {
      return;
    }

    setOnlineSaving(true);
    setStatusMessage("");

    try {
      const updatedCourier = await updateCourierPortalOnlineStatus(token, nextOnlineStatus);
      setCourierProfile(updatedCourier);
      setStatusMessage(nextOnlineStatus === "online" ? "Siz online holatga o'tdingiz." : "Siz offline holatga o'tdingiz.");
    } catch (error) {
      console.error("[courier-dashboard] online toggle error", error);

      if (!handleUnauthorized(error)) {
        setStatusMessage(error.message || "Online holatini yangilab bo'lmadi.");
      }
    } finally {
      setOnlineSaving(false);
    }
  }, [courier, handleUnauthorized, setCourierProfile, token]);

  const handleOrderAction = useCallback(async (order) => {
    setActiveOrderId(order.id);
    setStatusMessage("");

    try {
      const updatedOrder = ["assigned", "ready_for_delivery"].includes(order.status)
        ? await acceptCourierOrder(token, order.id)
        : await deliverCourierOrder(token, order.id);
      applyOrderPatch(updatedOrder);
    } catch (error) {
      console.error("[courier-dashboard] order status update error", error);

      if (!handleUnauthorized(error)) {
        setStatusMessage(error.message || "Buyurtma statusini yangilab bo'lmadi.");
      }
    } finally {
      setActiveOrderId("");
    }
  }, [applyOrderPatch, handleUnauthorized, token]);

  if (!isAuthenticated) {
    return <Navigate replace to="/courier-login" />;
  }

  if (courierLoading && !courier) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(196,30,58,0.12),_transparent_40%),linear-gradient(180deg,#fffaf5_0%,#fff5ec_100%)] px-4 py-5">
        <div className="mx-auto max-w-md space-y-5">
          <PageHeader
            eyebrow="Courier"
            title="Kuryer panel"
            description="Profilingiz va biriktirilgan buyurtmalar yuklanmoqda."
          />
          <section className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">
            Ma'lumotlar yuklanmoqda...
          </section>
        </div>
      </div>
    );
  }

  if (courierErrorMessage && !courier) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(196,30,58,0.12),_transparent_40%),linear-gradient(180deg,#fffaf5_0%,#fff5ec_100%)] px-4 py-5">
        <div className="mx-auto max-w-md space-y-5">
          <PageHeader
            eyebrow="Courier"
            title="Kuryer panel"
            description="Profilni yuklashda xatolik yuz berdi."
          />
          <section className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {courierErrorMessage}
          </section>
        </div>
      </div>
    );
  }

  if (!courier) {
    return <Navigate replace to="/courier-login" />;
  }

  const isApproved = courier.status === "approved" && courier.isActive;
  const liveStatusTimestamp = ordersLastUpdatedAt || courierLastUpdatedAt;
  const liveStatusMode = ordersLiveMode || courierLiveMode;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(196,30,58,0.12),_transparent_40%),linear-gradient(180deg,#fffaf5_0%,#fff5ec_100%)] px-4 py-5">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[32px] bg-hero p-5 text-white shadow-2xl shadow-lazzat-maroon/25">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">Courier portal</p>
              <h1 className="mt-3 text-3xl font-bold">Lazzat Oshxonasi</h1>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Biriktirilgan buyurtmalar, online holat va tezkor xarita havolalari shu yerda.
              </p>
            </div>
            <button type="button" onClick={clearSession} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
              Chiqish
            </button>
          </div>
        </section>

        <section className="surface-card rounded-[32px] p-6 sm:p-7">
          <PageHeader
            eyebrow="Courier"
            title={isApproved ? "Kuryer dashboard" : courier.status === "pending" ? "Tasdiqlash kutilmoqda" : "Kirish cheklangan"}
            description={isApproved
              ? "Sizga biriktirilgan buyurtmalar avtomatik yangilanadi."
              : courier.status === "pending"
                ? "Admin tasdiqlagach yetkazmalar shu yerda ko'rinadi."
                : "Kuryer profilingiz bloklangan yoki faollashtirilmagan."}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Profil</p>
              <p className="mt-2 text-lg font-bold text-lazzat-maroon">{courier.fullName}</p>
              <p className="mt-1 text-sm text-lazzat-ink/70">{courier.phone || "Telefon yo'q"}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
                {formatTransportLabel(courier)}
              </p>
            </div>
            <LiveFeedStatus liveMode={liveStatusMode} lastUpdatedAt={liveStatusTimestamp} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4 text-sm text-lazzat-ink/75">
              <p><span className="font-bold text-lazzat-maroon">Holat:</span> {courier.status}</p>
              <p className="mt-2"><span className="font-bold text-lazzat-maroon">Online:</span> {courier.onlineStatus || "offline"}</p>
            </div>
            <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4 text-sm text-lazzat-ink/75">
              <p><span className="font-bold text-lazzat-maroon">Faol buyurtmalar:</span> {summary.orderCount}</p>
              <p className="mt-2"><span className="font-bold text-lazzat-maroon">Jami summa:</span> {formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>

          {isApproved ? (
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => handleOnlineToggle("online")}
                disabled={onlineSaving || courier.onlineStatus === "online"}
                className="primary-button flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {onlineSaving && courier.onlineStatus !== "online" ? "Saqlanmoqda..." : "Online"}
              </button>
              <button
                type="button"
                onClick={() => handleOnlineToggle("offline")}
                disabled={onlineSaving || courier.onlineStatus === "offline"}
                className="secondary-button flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {onlineSaving && courier.onlineStatus === "online" ? "Saqlanmoqda..." : "Offline"}
              </button>
            </div>
          ) : null}
        </section>

        {statusMessage ? (
          <section className={`surface-card rounded-[28px] p-5 text-sm ${statusMessage.includes("o'tdingiz") || statusMessage.includes("qabul qilindi") || statusMessage.includes("yetkazildi") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
            {statusMessage}
          </section>
        ) : null}

        {courier.status === "pending" ? (
          <section className="surface-card rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            Profilingiz ko'rib chiqilmoqda. Admin tasdiqlagach shu sahifada biriktirilgan yetkazmalar ko'rinadi.
          </section>
        ) : null}

        {(courier.status === "blocked" || !courier.isActive) && courier.status !== "pending" ? (
          <section className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
            Kuryer profilingiz bloklangan yoki faollashtirilmagan. Iltimos, operator bilan bog'laning.
          </section>
        ) : null}

        {isApproved ? (
          <>
            {ordersLoading ? (
              <section className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">
                Buyurtmalar yuklanmoqda...
              </section>
            ) : null}

            {ordersErrorMessage ? (
              <section className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                {ordersErrorMessage}
              </section>
            ) : null}

            {!ordersLoading && !ordersErrorMessage && !activeOrders.length ? (
              <section className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">
                Hozircha sizga biriktirilgan faol buyurtmalar yo'q.
              </section>
            ) : null}

            {!ordersLoading && !ordersErrorMessage ? (
              <div className="space-y-4">
                {activeOrders.map((order) => {
                  const hasCoordinates = order.customerLat !== null && order.customerLng !== null;
                  const mapUrl = hasCoordinates
                    ? `https://maps.google.com/?q=${order.customerLat},${order.customerLng}`
                    : null;
                  const actionLabel = ["assigned", "ready_for_delivery"].includes(order.status) ? "Qabul qilish" : "Yetkazildi";

                  return (
                    <section key={order.id} className="surface-card space-y-4 rounded-[30px] p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="section-label">Buyurtma</p>
                          <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">{order.customerName}</h2>
                          <p className="mt-1 text-sm text-lazzat-ink/70">{order.phone}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
                            ID: {order.id}
                          </p>
                        </div>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      <div className="rounded-[24px] border border-lazzat-gold/15 bg-white/75 p-4 text-sm text-lazzat-ink/75">
                        <p>
                          <span className="font-bold text-lazzat-maroon">Manzil:</span> {order.address}
                        </p>
                        <p className="mt-2">
                          <span className="font-bold text-lazzat-maroon">Masofa:</span> {formatDistance(order.deliveryDistanceKm)}
                        </p>
                        <p className="mt-2">
                          <span className="font-bold text-lazzat-maroon">Delivery fee:</span> {formatCurrency(order.deliveryFee)}
                        </p>
                        <p className="mt-2">
                          <span className="font-bold text-lazzat-maroon">Jami:</span> {formatCurrency(order.totalAmount)}
                        </p>
                        <p className="mt-2">
                          <span className="font-bold text-lazzat-maroon">Biriktirilgan:</span> {formatDate(order.assignedAt)}
                        </p>
                        {hasCoordinates ? (
                          <>
                            <p className="mt-2">
                              <span className="font-bold text-lazzat-maroon">Latitude:</span> {formatCoordinate(order.customerLat)}
                            </p>
                            <p className="mt-1">
                              <span className="font-bold text-lazzat-maroon">Longitude:</span> {formatCoordinate(order.customerLng)}
                            </p>
                          </>
                        ) : null}
                      </div>

                      <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="section-label">Mahsulotlar</p>
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-lazzat-red/60">
                            {order.items.length} ta
                          </span>
                        </div>
                        <div className="mt-3 space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id || `${item.productId}-${item.productName}`} className="rounded-[20px] border border-white/70 bg-white/75 p-3">
                              <p className="text-sm font-bold text-lazzat-maroon">{item.productName}</p>
                              <p className="mt-1 text-sm text-lazzat-ink/70">
                                {item.quantity} x {formatCurrency(item.unitPrice)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-lazzat-maroon">
                                {formatCurrency(item.lineTotal)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {mapUrl ? (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button w-full"
                          >
                            Xaritada ochish
                          </a>
                        ) : (
                          <span className="secondary-button w-full cursor-not-allowed opacity-60">
                            Koordinata yo'q
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOrderAction(order)}
                          disabled={activeOrderId === order.id}
                          className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {activeOrderId === order.id ? "Saqlanmoqda..." : actionLabel}
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        <section className="text-center text-sm text-lazzat-ink/60">
          <Link to="/" className="font-semibold text-lazzat-maroon underline-offset-4 hover:underline">
            Mijoz sahifasiga o'tish
          </Link>
        </section>
      </div>
    </div>
  );
}

export default CourierDashboardPage;