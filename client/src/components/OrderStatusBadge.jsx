const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  assigned: "bg-cyan-100 text-cyan-800 border-cyan-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-violet-100 text-violet-800 border-violet-200",
  ready_for_delivery: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  on_the_way: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200"
};

const STATUS_LABELS = {
  pending: "Kutilmoqda",
  assigned: "Biriktirildi",
  accepted: "Qabul qilindi",
  preparing: "Tayyorlanmoqda",
  ready_for_delivery: "Yetkazishga tayyor",
  on_the_way: "Yo'lda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi"
};

function OrderStatusBadge({ status }) {
  const normalizedStatus = status || "pending";
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.pending;
  const label = STATUS_LABELS[normalizedStatus] || normalizedStatus;

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${style}`}>
      {label}
    </span>
  );
}

export { STATUS_LABELS };
export default OrderStatusBadge;