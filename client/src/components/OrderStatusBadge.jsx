const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-violet-100 text-violet-800 border-violet-200",
  on_the_way: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200"
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled"
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