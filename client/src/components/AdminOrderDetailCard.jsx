import OrderStatusBadge, { STATUS_LABELS } from "./OrderStatusBadge";
import { formatCurrency } from "../utils/formatCurrency";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCoordinate(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toFixed(6);
}

function AdminOrderDetailCard({
  order,
  statusValue,
  statusSaving,
  detailLoading,
  onStatusChange,
  onStatusSubmit,
  approvedCouriers = [],
  courierValue,
  assignmentSaving,
  assignmentMessage,
  assignmentUnavailableReason,
  onCourierChange,
  onAssignCourier,
  onClearCourier
}) {
  if (!order) {
    return (
      <div className="surface-card rounded-[32px] p-6 text-sm leading-6 text-lazzat-ink/70">
        Buyurtma tafsilotlarini ko'rish uchun chap tomondan bitta buyurtmani tanlang.
      </div>
    );
  }

  const canOpenMap = order.customerLat !== null && order.customerLng !== null;
  const mapUrl = canOpenMap
    ? `https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`
    : null;
  const assignedCourier = order.courier || null;
  const canAssignCourier = !assignmentUnavailableReason;
  const assignButtonDisabled = (
    assignmentSaving ||
    detailLoading ||
    !courierValue ||
    courierValue === (order.courierId || "")
  );

  return (
    <section className="surface-card rounded-[32px] p-6 sm:p-7">
      <div className="flex flex-col gap-4 border-b border-lazzat-gold/15 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-label">Buyurtma tafsiloti</p>
          <h2 className="mt-3 text-2xl font-bold text-lazzat-maroon">{order.customerName}</h2>
          <p className="mt-2 text-sm text-lazzat-ink/70">{order.phone}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
            ID: {order.id}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <OrderStatusBadge status={order.status} />
          <p className="text-sm text-lazzat-ink/65">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
          <p className="section-label">Mijoz</p>
          <p className="mt-3 text-sm font-bold text-lazzat-maroon">{order.customerName}</p>
          <p className="mt-1 text-sm text-lazzat-ink/70">{order.phone}</p>
          <p className="mt-3 text-sm leading-6 text-lazzat-ink/75">{order.address}</p>
          <p className="mt-3 text-sm leading-6 text-lazzat-ink/70">
            <span className="font-bold text-lazzat-maroon">Izoh:</span> {order.notes || "-"}
          </p>
        </div>

        <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
          <p className="section-label">Yetkazib berish</p>
          <div className="mt-3 space-y-2 text-sm text-lazzat-ink/75">
            <p>
              <span className="font-bold text-lazzat-maroon">Masofa:</span> {order.deliveryDistanceKm ?? "-"} km
            </p>
            <p>
              <span className="font-bold text-lazzat-maroon">Yetkazib berish narxi:</span> {formatCurrency(order.deliveryFee)}
            </p>
            <p>
              <span className="font-bold text-lazzat-maroon">Latitude:</span> {formatCoordinate(order.customerLat)}
            </p>
            <p>
              <span className="font-bold text-lazzat-maroon">Longitude:</span> {formatCoordinate(order.customerLng)}
            </p>
          </div>
          {mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="secondary-button mt-4 w-full"
            >
              Xaritada ochish
            </a>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/70 p-4">
          <p className="section-label">To'lov</p>
          <div className="mt-3 space-y-2 text-sm text-lazzat-ink/75">
            <p>
              <span className="font-bold text-lazzat-maroon">Subtotal:</span> {formatCurrency(order.subtotalAmount)}
            </p>
            <p>
              <span className="font-bold text-lazzat-maroon">Delivery fee:</span> {formatCurrency(order.deliveryFee)}
            </p>
            <p className="text-base font-bold text-lazzat-maroon">
              Jami: {formatCurrency(order.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-lazzat-gold/15 bg-white/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-label">Status boshqaruvi</p>
            <p className="mt-2 text-sm leading-6 text-lazzat-ink/70">
              Buyurtma holatini yangilang. Kuryerga tayyor buyurtmalar uchun `Yetkazishga tayyor` yoki `Yo'lda` statusidan foydalaning.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <select
              value={statusValue}
              onChange={(event) => onStatusChange(event.target.value)}
              className="field-input min-w-[220px]"
              disabled={statusSaving || detailLoading}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onStatusSubmit}
              disabled={statusSaving || detailLoading || statusValue === order.status}
              className="primary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusSaving ? "Saqlanmoqda..." : "Statusni saqlash"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-lazzat-gold/15 bg-white/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-label">Kuryer biriktirish</p>
            <p className="mt-2 text-sm leading-6 text-lazzat-ink/70">
              Tasdiqlangan kuryerni biriktiring, qayta biriktiring yoki kerak bo'lsa olib tashlang.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/60 p-4 text-sm text-lazzat-ink/75">
          {assignedCourier ? (
            <div className="space-y-2">
              <p>
                <span className="font-bold text-lazzat-maroon">Biriktirilgan kuryer:</span> {assignedCourier.fullName}
              </p>
              <p>
                <span className="font-bold text-lazzat-maroon">Telefon:</span> {assignedCourier.phone || "-"}
              </p>
              <p>
                <span className="font-bold text-lazzat-maroon">Telegram:</span> {assignedCourier.username ? `@${assignedCourier.username}` : "-"}
              </p>
              <p>
                <span className="font-bold text-lazzat-maroon">Biriktirilgan vaqti:</span> {order.assignedAt ? formatDate(order.assignedAt) : "-"}
              </p>
            </div>
          ) : (
            <p>Hozircha kuryer biriktirilmagan.</p>
          )}
        </div>

        {assignmentUnavailableReason ? (
          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {assignmentUnavailableReason}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <select
              value={courierValue}
              onChange={(event) => onCourierChange(event.target.value)}
              className="field-input lg:max-w-sm"
              disabled={!canAssignCourier || assignmentSaving}
            >
              <option value="">Kuryerni tanlang</option>
              {approvedCouriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.fullName}{courier.phone ? ` - ${courier.phone}` : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onAssignCourier}
              disabled={!canAssignCourier || assignButtonDisabled}
              className="primary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assignmentSaving ? "Saqlanmoqda..." : "Kuryerni saqlash"}
            </button>

            <button
              type="button"
              onClick={onClearCourier}
              disabled={!canAssignCourier || assignmentSaving || !order.courierId}
              className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              Biriktirishni olib tashlash
            </button>
          </div>
        )}

        {assignmentMessage ? (
          <div className={`mt-4 rounded-[24px] border p-4 text-sm ${assignmentMessage.includes("muvaffaqiyatli") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {assignmentMessage}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="section-label">Mahsulotlar</p>
          <span className="text-sm font-semibold text-lazzat-ink/60">{order.items.length} ta pozitsiya</span>
        </div>

        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id || `${item.productId}-${item.productName}`}
              className="flex flex-col gap-2 rounded-[24px] border border-lazzat-gold/15 bg-lazzat-cream/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-base font-bold text-lazzat-maroon">{item.productName}</p>
                <p className="mt-1 text-sm text-lazzat-ink/65">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
              </div>
              <p className="text-base font-bold text-lazzat-maroon">{formatCurrency(item.lineTotal)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AdminOrderDetailCard;
