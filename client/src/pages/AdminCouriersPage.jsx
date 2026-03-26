import { useCallback, useEffect, useMemo, useState } from "react";
import { updateCourierStatus } from "../api/client";
import LiveFeedStatus from "../components/LiveFeedStatus";
import { useLiveCouriers } from "../hooks/useLiveCouriers";

const STATUS_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "pending", label: "Kutilmoqda" },
  { value: "approved", label: "Tasdiqlangan" },
  { value: "blocked", label: "Bloklangan" }
];

const STATUS_BADGE_STYLES = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200"
};

const STATUS_LABELS = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  blocked: "Bloklangan"
};

const TRANSPORT_LABELS = {
  foot: "Piyoda",
  bike: "Velik",
  moto: "Moto",
  car: "Avto"
};

const ONLINE_STATUS_LABELS = {
  online: "Online",
  offline: "Offline"
};

const ONLINE_STATUS_STYLES = {
  online: "bg-emerald-100 text-emerald-800 border-emerald-200",
  offline: "bg-slate-100 text-slate-700 border-slate-200"
};

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTransportType(value) {
  return TRANSPORT_LABELS[value] || "Kiritilmagan";
}

function formatOptionalText(value) {
  return value || "-";
}

function CourierStatusBadge({ status }) {
  const normalizedStatus = status || "pending";
  const style = STATUS_BADGE_STYLES[normalizedStatus] || STATUS_BADGE_STYLES.pending;
  const label = STATUS_LABELS[normalizedStatus] || normalizedStatus;

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${style}`}>
      {label}
    </span>
  );
}

function CourierOnlineBadge({ onlineStatus }) {
  const normalizedStatus = onlineStatus || "offline";
  const style = ONLINE_STATUS_STYLES[normalizedStatus] || ONLINE_STATUS_STYLES.offline;
  const label = ONLINE_STATUS_LABELS[normalizedStatus] || normalizedStatus;

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${style}`}>
      {label}
    </span>
  );
}

function AdminCouriersPage() {
  const {
    couriers,
    isInitialLoading,
    error,
    errorMessage,
    lastUpdatedAt,
    liveMode,
    applyCourierPatch
  } = useLiveCouriers({
    channelKey: "admin-couriers-page"
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const schemaUnavailable = error?.details?.code === "COURIER_SCHEMA_NOT_READY";

  const filteredCouriers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return couriers.filter((courier) => {
      const matchesStatus = statusFilter === "all" || courier.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        courier.fullName,
        courier.username,
        courier.phone,
        formatTransportType(courier.transportType),
        courier.transportColor,
        courier.vehicleBrand,
        courier.plateNumber,
        ONLINE_STATUS_LABELS[courier.onlineStatus] || courier.onlineStatus
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [couriers, searchQuery, statusFilter]);

  useEffect(() => {
    if (!filteredCouriers.length) {
      setSelectedCourierId("");
      return;
    }

    if (!selectedCourierId || !filteredCouriers.some((courier) => courier.id === selectedCourierId)) {
      setSelectedCourierId(filteredCouriers[0].id);
    }
  }, [filteredCouriers, selectedCourierId]);

  const selectedCourier = useMemo(
    () => couriers.find((courier) => courier.id === selectedCourierId) || null,
    [couriers, selectedCourierId]
  );

  const stats = useMemo(() => ({
    total: couriers.length,
    pending: couriers.filter((courier) => courier.status === "pending").length,
    approved: couriers.filter((courier) => courier.status === "approved").length,
    blocked: couriers.filter((courier) => courier.status === "blocked").length,
    online: couriers.filter((courier) => courier.onlineStatus === "online").length
  }), [couriers]);

  const handleStatusChange = useCallback(async (courierId, status) => {
    setActionSaving(true);
    setActionMessage("");

    try {
      const updatedCourier = await updateCourierStatus(courierId, status);
      applyCourierPatch(updatedCourier);
      setActionMessage("Kuryer statusi muvaffaqiyatli yangilandi.");
    } catch (requestError) {
      console.error("[admin-couriers] status update error", requestError);
      setActionMessage(requestError.message || "Kuryer statusini yangilab bo'lmadi.");
    } finally {
      setActionSaving(false);
    }
  }, [applyCourierPatch]);

  if (schemaUnavailable) {
    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <p className="section-label text-amber-700">Courier setup</p>
          <p className="text-sm leading-6">
            Kuryer tizimini yoqish uchun avval Supabase bazasiga courier migratsiyasini qo'llash kerak.
          </p>
          <code className="rounded-2xl bg-white/80 px-4 py-3 text-xs text-amber-900">
            server/supabase/migrations/20260325_add_courier_assignment.sql
          </code>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[28px] border border-emerald-200/70 bg-white/75 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">Jonli kuzatuv</p>
          <p className="mt-2 text-sm text-lazzat-ink/70">
            Kuryerlar ro'yxati, filtrlar va tasdiqlash holati avtomatik yangilanadi.
          </p>
        </div>
        <LiveFeedStatus liveMode={liveMode} lastUpdatedAt={lastUpdatedAt} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Jami kuryer</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.total}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Kutilmoqda</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.pending}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Tasdiqlangan</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.approved}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Bloklangan</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.blocked}</p>
        </div>
        <div className="surface-card rounded-[28px] p-5">
          <p className="section-label">Online</p>
          <p className="mt-3 text-3xl font-bold text-lazzat-maroon">{stats.online}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="surface-card rounded-[28px] p-5">
            <p className="section-label">Kuryerlar ro'yxati</p>
            <h2 className="mt-2 text-xl font-bold text-lazzat-maroon">Courier approval</h2>
            <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
              Telegram ID orqali ro'yxatdan o'tgan kuryerlarni tekshiring va holatini yangilang.
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
                  placeholder="Ism, username, telefon, transport"
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
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-3 text-sm text-lazzat-ink/60">
              Topildi: <span className="font-bold text-lazzat-maroon">{filteredCouriers.length}</span>
            </p>
          </div>

          {isInitialLoading ? (
            <div className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">Kuryerlar yuklanmoqda...</div>
          ) : null}

          {errorMessage ? (
            <div className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {!isInitialLoading && !errorMessage ? (
            <div className="space-y-3">
              {filteredCouriers.length ? filteredCouriers.map((courier) => {
                const isActiveCard = courier.id === selectedCourierId;

                return (
                  <button
                    key={courier.id}
                    type="button"
                    onClick={() => setSelectedCourierId(courier.id)}
                    className={`surface-card w-full rounded-[28px] p-4 text-left transition ${isActiveCard ? "border-lazzat-red ring-2 ring-lazzat-red/10" : "hover:border-lazzat-gold/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-lazzat-red/65">
                          Telegram ID: {courier.telegramUserId}
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-lazzat-maroon">{courier.fullName}</h3>
                        <p className="mt-1 text-sm text-lazzat-ink/70">{courier.phone || "Telefon yo'q"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <CourierStatusBadge status={courier.status} />
                        <CourierOnlineBadge onlineStatus={courier.onlineStatus} />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-lazzat-ink/65">
                      {courier.username ? `@${courier.username}` : "Username yo'q"}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
                      Transport: {formatTransportType(courier.transportType)}
                    </p>
                    {(courier.vehicleBrand || courier.plateNumber) ? (
                      <p className="mt-2 text-xs text-lazzat-ink/60">
                        {courier.vehicleBrand || "Transport"}{courier.plateNumber ? ` • ${courier.plateNumber}` : ""}
                      </p>
                    ) : null}
                  </button>
                );
              }) : (
                <div className="surface-card rounded-[28px] p-5 text-sm text-lazzat-ink/70">Hozircha kuryerlar topilmadi.</div>
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {actionMessage ? (
            <div className={`surface-card rounded-[28px] p-5 text-sm ${actionMessage.includes("muvaffaqiyatli") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>
              {actionMessage}
            </div>
          ) : null}

          {!selectedCourier ? (
            <div className="surface-card rounded-[32px] p-6 text-sm leading-6 text-lazzat-ink/70">
              Tafsilotlarni ko'rish uchun chap tomondan bitta kuryerni tanlang.
            </div>
          ) : (
            <div className="surface-card rounded-[32px] p-6 sm:p-7">
              <div className="flex flex-col gap-4 border-b border-lazzat-gold/15 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="section-label">Kuryer tafsiloti</p>
                  <h2 className="mt-3 text-2xl font-bold text-lazzat-maroon">{selectedCourier.fullName}</h2>
                  <p className="mt-2 text-sm text-lazzat-ink/70">{selectedCourier.phone || "Telefon ko'rsatilmagan"}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
                    Telegram ID: {selectedCourier.telegramUserId}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <CourierStatusBadge status={selectedCourier.status} />
                  <CourierOnlineBadge onlineStatus={selectedCourier.onlineStatus} />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4 text-sm text-lazzat-ink/75">
                  <p>
                    <span className="font-bold text-lazzat-maroon">Username:</span> {selectedCourier.username ? `@${selectedCourier.username}` : "-"}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Faol holat:</span> {selectedCourier.isActive ? "Faol" : "Faol emas"}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Transport:</span> {formatTransportType(selectedCourier.transportType)}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Transport rangi:</span> {formatOptionalText(selectedCourier.transportColor)}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Brend / model:</span> {formatOptionalText(selectedCourier.vehicleBrand)}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Davlat raqami:</span> {formatOptionalText(selectedCourier.plateNumber)}
                  </p>
                </div>

                <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4 text-sm text-lazzat-ink/75">
                  <p>
                    <span className="font-bold text-lazzat-maroon">Ro'yxatdan o'tgan:</span> {formatDate(selectedCourier.createdAt)}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Oxirgi yangilanish:</span> {formatDate(selectedCourier.updatedAt)}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Online:</span> {ONLINE_STATUS_LABELS[selectedCourier.onlineStatus] || selectedCourier.onlineStatus}
                  </p>
                  <p className="mt-2">
                    <span className="font-bold text-lazzat-maroon">Profil to'liq:</span> {selectedCourier.isProfileComplete ? "Ha" : "Yo'q"}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-lazzat-gold/15 bg-white/80 p-5">
                <p className="section-label">Boshqaruv</p>
                <p className="mt-2 text-sm leading-6 text-lazzat-ink/70">
                  Admin kuryerni tasdiqlashi, kutilmoqda holatiga qaytarishi yoki bloklashi mumkin.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedCourier.id, "approved")}
                    disabled={actionSaving || selectedCourier.status === "approved"}
                    className="primary-button disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Tasdiqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedCourier.id, "pending")}
                    disabled={actionSaving || selectedCourier.status === "pending"}
                    className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Kutilmoqda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedCourier.id, "blocked")}
                    disabled={actionSaving || selectedCourier.status === "blocked"}
                    className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Bloklash
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default AdminCouriersPage;
