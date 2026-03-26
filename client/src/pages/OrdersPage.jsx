import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../api/client";
import OrderStatusBadge from "../components/OrderStatusBadge";
import PageHeader from "../components/PageHeader";
import { useTelegram } from "../hooks/useTelegram";
import { formatCurrency } from "../utils/formatCurrency";

function formatDateTime(value) {
  if (!value) {
    return "Noma'lum";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

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

function getOrdersDiagnosticMessage({ isTelegramWebApp, initData, diagnostics }) {
  if (!isTelegramWebApp) {
    return "Buyurtmalar tarixini ko'rish uchun sahifani Telegram Mini App ichida oching.";
  }

  if (!initData) {
    return "Telegram initData kelmadi. Botdagi Mini App tugmasidan qayta ochib ko'ring.";
  }

  if (!diagnostics.hasUnsafeUser && !diagnostics.hasParsedInitUser) {
    return "Telegram initData mavjud, lekin foydalanuvchi identifikatori undan o'qilmadi. Sahifani bot ichidan qayta oching.";
  }

  return "Telegram foydalanuvchi identifikatori topilmadi.";
}

function OrdersPage() {
  const { user, webApp, initData, isTelegramWebApp, diagnostics } = useTelegram();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canLoadOrders = useMemo(() => Boolean(user?.id || initData), [initData, user?.id]);

  const loadOrders = useCallback(async () => {
    if (!canLoadOrders) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextOrders = await getMyOrders(user?.id || null);
      setOrders(nextOrders);
    } catch (requestError) {
      console.error("[orders] my orders load error", requestError);
      setError(requestError.message || "Buyurtmalarni yuklab bo'lmadi.");
      webApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setIsLoading(false);
    }
  }, [canLoadOrders, user?.id, webApp]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (!canLoadOrders) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Buyurtmalarim"
          title="Buyurtmalarni ko'rish uchun Telegram orqali oching"
          description="Buyurtmalar tarixini ko'rish uchun ilovani Telegram Mini App ichida ishga tushiring."
        />

        <section className="surface-card space-y-3 text-sm leading-6 text-lazzat-ink/70">
          <p>{getOrdersDiagnosticMessage({ isTelegramWebApp, initData, diagnostics })}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Buyurtmalarim"
        title="Buyurtmalarim"
        description="Siz yuborgan buyurtmalar holatini shu yerda kuzatishingiz mumkin."
      />

      <section className="surface-card flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Mijoz</p>
          <p className="mt-2 text-base font-bold text-lazzat-maroon">
            {user?.first_name || "Telegram foydalanuvchi"}
          </p>
        </div>
        <button type="button" onClick={loadOrders} className="secondary-button">
          Yangilash
        </button>
      </section>

      {isLoading ? (
        <section className="surface-card text-sm text-lazzat-ink/70">
          Buyurtmalar yuklanmoqda...
        </section>
      ) : null}

      {error ? (
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {!isLoading && !error && orders.length === 0 ? (
        <section className="surface-card space-y-4 text-sm text-lazzat-ink/70">
          <p>Hozircha buyurtmalar topilmadi.</p>
          <Link to="/" className="primary-button w-full">
            Menyuga o'tish
          </Link>
        </section>
      ) : null}

      {!isLoading && !error ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <section key={order.id} className="surface-card space-y-4 rounded-[30px] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="section-label">Buyurtma</p>
                  <p className="mt-2 text-base font-bold text-lazzat-maroon">ID: {order.id}</p>
                  <p className="mt-1 text-sm text-lazzat-ink/65">{formatDateTime(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">
                    Jami
                  </p>
                  <p className="mt-2 text-base font-bold text-lazzat-maroon">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
                <div className="rounded-[22px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">
                    Delivery fee
                  </p>
                  <p className="mt-2 text-base font-bold text-lazzat-maroon">
                    {formatCurrency(order.deliveryFee)}
                  </p>
                </div>
                <div className="rounded-[22px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/60">
                    Masofa
                  </p>
                  <p className="mt-2 text-base font-bold text-lazzat-maroon">
                    {formatDistance(order.deliveryDistanceKm)}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-lazzat-gold/15 bg-white/75 p-4 text-sm text-lazzat-ink/75">
                <p>
                  <span className="font-bold text-lazzat-maroon">Manzil:</span> {order.address}
                </p>
                <p className="mt-2">
                  <span className="font-bold text-lazzat-maroon">Izoh:</span> {order.notes || "-"}
                </p>
                <p className="mt-2">
                  <span className="font-bold text-lazzat-maroon">Latitude:</span> {formatCoordinate(order.customerLat)}
                </p>
                <p className="mt-1">
                  <span className="font-bold text-lazzat-maroon">Longitude:</span> {formatCoordinate(order.customerLng)}
                </p>
              </div>

              <div>
                <p className="section-label">Mahsulotlar</p>
                <div className="mt-3 space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id || `${item.productId}-${item.productName}`}
                      className="flex items-center justify-between gap-3 rounded-[22px] border border-lazzat-gold/15 bg-lazzat-cream/60 p-4 text-sm"
                    >
                      <div>
                        <p className="font-bold text-lazzat-maroon">{item.productName}</p>
                        <p className="mt-1 text-lazzat-ink/65">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-bold text-lazzat-maroon">{formatCurrency(item.lineTotal)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default OrdersPage;
