import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { updateOrderStatus } from "../api/client";
import LiveFeedStatus from "../components/LiveFeedStatus";
import OrderStatusBadge from "../components/OrderStatusBadge";
import PageHeader from "../components/PageHeader";
import { useLiveOrders } from "../hooks/useLiveOrders";

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

function CourierPage() {
  const {
    orders,
    isInitialLoading,
    error,
    lastUpdatedAt,
    liveMode,
    applyOrderPatch
  } = useLiveOrders();
  const [activeOrderId, setActiveOrderId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const activeDeliveries = useMemo(
    () => orders.filter((order) => order.status === "on_the_way"),
    [orders]
  );

  const handleDelivered = useCallback(async (orderId) => {
    setActiveOrderId(orderId);
    setStatusMessage("");

    try {
      const updatedOrder = await updateOrderStatus(orderId, "delivered");
      applyOrderPatch(updatedOrder);
    } catch (requestError) {
      console.error("[courier] delivered update error", requestError);
      setStatusMessage(requestError.message || "Statusni yangilab bo'lmadi.");
    } finally {
      setActiveOrderId("");
    }
  }, [applyOrderPatch]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Courier"
        title="Aktiv yetkazmalar"
        description="Yo'ldagi buyurtmalarni ko'ring, xaritani oching va yetkazib berilganini belgilang."
      />

      <section className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">Aktiv buyurtmalar</p>
          <p className="mt-2 text-2xl font-bold text-lazzat-maroon">{activeDeliveries.length}</p>
        </div>
        <LiveFeedStatus liveMode={liveMode} lastUpdatedAt={lastUpdatedAt} />
      </section>

      {isInitialLoading ? (
        <section className="surface-card text-sm text-lazzat-ink/70">
          Yetkazmalar yuklanmoqda...
        </section>
      ) : null}

      {error ? (
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {statusMessage ? (
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {statusMessage}
        </section>
      ) : null}

      {!isInitialLoading && !error && activeDeliveries.length === 0 ? (
        <section className="surface-card space-y-4 text-sm text-lazzat-ink/70">
          <p>Hozircha yo'ldagi buyurtmalar topilmadi.</p>
          <Link to="/" className="primary-button w-full">
            Bosh sahifaga qaytish
          </Link>
        </section>
      ) : null}

      {!isInitialLoading && !error ? (
        <div className="space-y-4">
          {activeDeliveries.map((order) => {
            const hasCoordinates = order.customerLat !== null && order.customerLng !== null;
            const mapUrl = hasCoordinates
              ? `https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`
              : null;

            return (
              <section key={order.id} className="surface-card space-y-4 rounded-[30px] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="section-label">Yetkazma</p>
                    <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">{order.customerName}</h2>
                    <p className="mt-1 text-sm text-lazzat-ink/70">{order.phone}</p>
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
                    onClick={() => handleDelivered(order.id)}
                    disabled={activeOrderId === order.id}
                    className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {activeOrderId === order.id ? "Saqlanmoqda..." : "Yetkazildi"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default CourierPage;
