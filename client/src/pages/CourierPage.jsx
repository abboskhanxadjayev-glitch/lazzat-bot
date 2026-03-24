import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCourierOrders, registerCourier, updateOrderStatus } from "../api/client";
import LiveFeedStatus from "../components/LiveFeedStatus";
import OrderStatusBadge from "../components/OrderStatusBadge";
import PageHeader from "../components/PageHeader";
import { useLiveCourierProfile } from "../hooks/useLiveCourierProfile";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { useTelegram } from "../hooks/useTelegram";

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

function mapTelegramUser(user) {
  if (!user?.id) {
    return null;
  }

  return {
    id: Number(user.id),
    username: user.username || null,
    firstName: user.first_name || null,
    lastName: user.last_name || null
  };
}

function CourierPage() {
  const { user, displayName } = useTelegram();
  const [registrationForm, setRegistrationForm] = useState({
    fullName: "",
    phone: ""
  });
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [activeOrderId, setActiveOrderId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const telegramUser = useMemo(() => mapTelegramUser(user), [user]);
  const courierFetchEnabled = Boolean(telegramUser?.id);
  const fetchAssignedOrders = useCallback(
    ({ signal }) => telegramUser?.id ? getCourierOrders(telegramUser.id, { signal }) : Promise.resolve([]),
    [telegramUser?.id]
  );

  const {
    courier,
    isInitialLoading: courierLoading,
    error: courierError,
    errorMessage: courierErrorMessage,
    lastUpdatedAt: courierLastUpdatedAt,
    liveMode: courierLiveMode,
    setCourierProfile
  } = useLiveCourierProfile({
    telegramUserId: telegramUser?.id,
    enabled: courierFetchEnabled
  });

  const courierSchemaMissing = courierError?.details?.code === "COURIER_SCHEMA_NOT_READY";

  const {
    orders: legacyOrders,
    isInitialLoading: legacyLoading,
    errorMessage: legacyErrorMessage,
    lastUpdatedAt: legacyLastUpdatedAt,
    liveMode: legacyLiveMode,
    applyOrderPatch: applyLegacyOrderPatch
  } = useLiveOrders({
    enabled: courierSchemaMissing,
    channelKey: "courier-legacy-board"
  });

  const {
    orders: courierOrders,
    isInitialLoading: assignedOrdersLoading,
    errorMessage: assignedOrdersErrorMessage,
    lastUpdatedAt: assignedOrdersUpdatedAt,
    liveMode: assignedOrdersLiveMode,
    applyOrderPatch: applyCourierOrderPatch
  } = useLiveOrders({
    fetchOrders: fetchAssignedOrders,
    enabled: Boolean(telegramUser?.id && courier?.status === "approved"),
    channelKey: `courier-assigned-${telegramUser?.id || "guest"}`
  });

  useEffect(() => {
    if (!registrationForm.fullName) {
      setRegistrationForm((currentForm) => ({
        ...currentForm,
        fullName: displayName
      }));
    }
  }, [displayName, registrationForm.fullName]);

  const legacyActiveDeliveries = useMemo(
    () => legacyOrders.filter((order) => order.status === "on_the_way"),
    [legacyOrders]
  );

  const assignedDeliveries = useMemo(
    () => courierOrders.filter((order) => ["ready_for_delivery", "on_the_way"].includes(order.status)),
    [courierOrders]
  );

  const handleRegistrationFieldChange = useCallback((field, value) => {
    setRegistrationForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }, []);

  const handleRegisterCourier = useCallback(async () => {
    if (!telegramUser) {
      return;
    }

    setRegistrationSaving(true);
    setRegistrationMessage("");

    try {
      const nextCourier = await registerCourier({
        fullName: registrationForm.fullName.trim(),
        phone: registrationForm.phone.trim(),
        telegramUser
      });
      setCourierProfile(nextCourier);
      setRegistrationMessage("So'rovingiz yuborildi. Admin tasdiqlashini kuting.");
    } catch (requestError) {
      console.error("[courier] registration error", requestError);
      setRegistrationMessage(requestError.message || "Kuryer ro'yxatdan o'tmadi.");
    } finally {
      setRegistrationSaving(false);
    }
  }, [registrationForm.fullName, registrationForm.phone, setCourierProfile, telegramUser]);

  const handleCourierAction = useCallback(async (order) => {
    const nextStatus = order.status === "ready_for_delivery" ? "on_the_way" : "delivered";

    setActiveOrderId(order.id);
    setStatusMessage("");

    try {
      const updatedOrder = await updateOrderStatus(order.id, nextStatus);
      applyCourierOrderPatch(updatedOrder);
    } catch (requestError) {
      console.error("[courier] status update error", requestError);
      setStatusMessage(requestError.message || "Buyurtma statusini yangilab bo'lmadi.");
    } finally {
      setActiveOrderId("");
    }
  }, [applyCourierOrderPatch]);

  const handleLegacyDelivered = useCallback(async (orderId) => {
    setActiveOrderId(orderId);
    setStatusMessage("");

    try {
      const updatedOrder = await updateOrderStatus(orderId, "delivered");
      applyLegacyOrderPatch(updatedOrder);
    } catch (requestError) {
      console.error("[courier] legacy delivered error", requestError);
      setStatusMessage(requestError.message || "Statusni yangilab bo'lmadi.");
    } finally {
      setActiveOrderId("");
    }
  }, [applyLegacyOrderPatch]);

  if (!telegramUser?.id) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Kuryer panelini Telegram ichida oching"
          description="Kuryer panelidan foydalanish uchun ilovani Telegram Mini App ichida ishga tushiring."
        />

        <section className="surface-card text-sm leading-6 text-lazzat-ink/70">
          Telegram foydalanuvchi identifikatori topilmadi.
        </section>
      </div>
    );
  }

  if (courierSchemaMissing) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Aktiv yetkazmalar"
          description="Courier schema hali qo'llanmaganligi uchun vaqtincha umumiy yetkazmalar ro'yxati ko'rsatilmoqda."
        />

        <section className="surface-card flex flex-col gap-4 border border-amber-200 bg-amber-50 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label text-amber-700">Compat mode</p>
            <p className="mt-2 text-sm leading-6">
              To'liq courier assignment tizimi migration qo'llangandan keyin avtomatik yoqiladi.
            </p>
          </div>
          <LiveFeedStatus liveMode={legacyLiveMode} lastUpdatedAt={legacyLastUpdatedAt} />
        </section>

        {legacyLoading ? (
          <section className="surface-card text-sm text-lazzat-ink/70">
            Yetkazmalar yuklanmoqda...
          </section>
        ) : null}

        {legacyErrorMessage ? (
          <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
            {legacyErrorMessage}
          </section>
        ) : null}

        {statusMessage ? (
          <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
            {statusMessage}
          </section>
        ) : null}

        {!legacyLoading && !legacyErrorMessage && !legacyActiveDeliveries.length ? (
          <section className="surface-card space-y-4 text-sm text-lazzat-ink/70">
            <p>Hozircha yo'ldagi buyurtmalar topilmadi.</p>
            <Link to="/" className="primary-button w-full">
              Bosh sahifaga qaytish
            </Link>
          </section>
        ) : null}

        {!legacyLoading && !legacyErrorMessage ? (
          <div className="space-y-4">
            {legacyActiveDeliveries.map((order) => {
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
                      onClick={() => handleLegacyDelivered(order.id)}
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

  if (courierLoading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Kuryer paneli"
          description="Kuryer profilingiz tekshirilmoqda."
        />
        <section className="surface-card text-sm text-lazzat-ink/70">
          Kuryer ma'lumotlari yuklanmoqda...
        </section>
      </div>
    );
  }

  if (courierErrorMessage) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Kuryer paneli"
          description="Kuryer tizimi bilan ulanishda xatolik yuz berdi."
        />
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {courierErrorMessage}
        </section>
      </div>
    );
  }

  if (!courier) {
    const isFormReady = registrationForm.fullName.trim().length >= 2 && registrationForm.phone.trim().length >= 7;

    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Kuryer sifatida ro'yxatdan o'ting"
          description="Telegram profilingiz asosida kuryer so'rovini yuboring. Admin tasdiqlagach shu yerda biriktirilgan buyurtmalar ko'rinadi."
        />

        <section className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Telegram profil</p>
            <p className="mt-2 text-base font-bold text-lazzat-maroon">{displayName}</p>
            <p className="mt-1 text-sm text-lazzat-ink/70">ID: {telegramUser.id}</p>
          </div>
          <LiveFeedStatus liveMode={courierLiveMode} lastUpdatedAt={courierLastUpdatedAt} />
        </section>

        <section className="surface-card space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
              F.I.Sh.
            </span>
            <input
              type="text"
              value={registrationForm.fullName}
              onChange={(event) => handleRegistrationFieldChange("fullName", event.target.value)}
              className="field-input"
              placeholder="Ism familiya"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
              Telefon
            </span>
            <input
              type="tel"
              value={registrationForm.phone}
              onChange={(event) => handleRegistrationFieldChange("phone", event.target.value)}
              className="field-input"
              placeholder="+998 90 123 45 67"
            />
          </label>

          <button
            type="button"
            onClick={handleRegisterCourier}
            disabled={!isFormReady || registrationSaving}
            className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {registrationSaving ? "Yuborilmoqda..." : "Kuryer bo'lib ro'yxatdan o'tish"}
          </button>
        </section>

        {registrationMessage ? (
          <section className={`surface-card text-sm ${registrationMessage.includes("kuting") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
            {registrationMessage}
          </section>
        ) : null}
      </div>
    );
  }

  if (courier.status === "pending") {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Tasdiqlash kutilmoqda"
          description="So'rovingiz saqlandi. Admin tasdiqlagach kuryer panelida biriktirilgan buyurtmalar ko'rinadi."
        />

        <section className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">So'rov holati</p>
            <p className="mt-2 text-base font-bold text-lazzat-maroon">{courier.fullName}</p>
            <p className="mt-1 text-sm text-lazzat-ink/70">{courier.phone || "Telefon kiritilmagan"}</p>
            <p className="mt-1 text-sm text-lazzat-ink/70">{courier.username ? `@${courier.username}` : "Username yo'q"}</p>
          </div>
          <LiveFeedStatus liveMode={courierLiveMode} lastUpdatedAt={courierLastUpdatedAt} />
        </section>

        <section className="surface-card border border-amber-200 bg-amber-50 text-sm leading-6 text-amber-800">
          Profilingiz ko'rib chiqilmoqda. Admin tasdiqlashi bilan ushbu sahifa avtomatik yangilanadi.
        </section>
      </div>
    );
  }

  if (courier.status === "blocked" || !courier.isActive) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Courier"
          title="Kirish cheklangan"
          description="Kuryer profilingiz bloklangan yoki faollashtirilmagan."
        />

        <section className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Profil</p>
            <p className="mt-2 text-base font-bold text-lazzat-maroon">{courier.fullName}</p>
            <p className="mt-1 text-sm text-lazzat-ink/70">{courier.phone || "Telefon kiritilmagan"}</p>
          </div>
          <LiveFeedStatus liveMode={courierLiveMode} lastUpdatedAt={courierLastUpdatedAt} />
        </section>

        <section className="surface-card border border-rose-200 bg-rose-50 text-sm leading-6 text-rose-700">
          Iltimos, operator yoki admin bilan bog'laning.
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Courier"
        title="Mening yetkazmalarim"
        description="Sizga biriktirilgan yetkazmalar shu yerda avtomatik yangilanadi."
      />

      <section className="surface-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">Kuryer</p>
          <p className="mt-2 text-base font-bold text-lazzat-maroon">{courier.fullName}</p>
          <p className="mt-1 text-sm text-lazzat-ink/70">Aktiv yetkazmalar: {assignedDeliveries.length}</p>
        </div>
        <LiveFeedStatus liveMode={assignedOrdersLiveMode} lastUpdatedAt={assignedOrdersUpdatedAt} />
      </section>

      {assignedOrdersLoading ? (
        <section className="surface-card text-sm text-lazzat-ink/70">
          Yetkazmalar yuklanmoqda...
        </section>
      ) : null}

      {assignedOrdersErrorMessage ? (
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {assignedOrdersErrorMessage}
        </section>
      ) : null}

      {statusMessage ? (
        <section className="surface-card border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {statusMessage}
        </section>
      ) : null}

      {!assignedOrdersLoading && !assignedOrdersErrorMessage && !assignedDeliveries.length ? (
        <section className="surface-card space-y-4 text-sm text-lazzat-ink/70">
          <p>Hozircha sizga biriktirilgan faol yetkazmalar yo'q.</p>
          <Link to="/" className="primary-button w-full">
            Bosh sahifaga qaytish
          </Link>
        </section>
      ) : null}

      {!assignedOrdersLoading && !assignedOrdersErrorMessage ? (
        <div className="space-y-4">
          {assignedDeliveries.map((order) => {
            const hasCoordinates = order.customerLat !== null && order.customerLng !== null;
            const mapUrl = hasCoordinates
              ? `https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`
              : null;
            const actionLabel = order.status === "ready_for_delivery" ? "Yo'lga chiqdi" : "Yetkazildi";

            return (
              <section key={order.id} className="surface-card space-y-4 rounded-[30px] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="section-label">Yetkazma</p>
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
                    onClick={() => handleCourierAction(order)}
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
    </div>
  );
}

export default CourierPage;


