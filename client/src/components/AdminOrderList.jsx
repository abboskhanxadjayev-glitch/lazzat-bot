import OrderStatusBadge from "./OrderStatusBadge";
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

function AdminOrderList({ orders, selectedOrderId, onSelect }) {
  if (!orders.length) {
    return (
      <div className="surface-card rounded-[28px] text-sm leading-6 text-lazzat-ink/70">
        Hozircha buyurtmalar topilmadi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const isActive = order.id === selectedOrderId;

        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order.id)}
            className={`surface-card w-full rounded-[28px] p-4 text-left transition ${isActive ? "border-lazzat-red ring-2 ring-lazzat-red/10" : "hover:border-lazzat-gold/40"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-lazzat-red/65">
                  {formatDate(order.createdAt)}
                </p>
                <h3 className="mt-2 text-lg font-bold text-lazzat-maroon">{order.customerName}</h3>
                <p className="mt-1 text-sm text-lazzat-ink/70">{order.phone}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-6 text-lazzat-ink/75">{order.address}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-lazzat-red/60">
              <span>{order.items.length} ta mahsulot</span>
              <span>
                {order.courier?.fullName ? `Kuryer: ${order.courier.fullName}` : "Kuryer biriktirilmagan"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-lazzat-ink/70">
                {order.assignedAt ? `Biriktirildi: ${formatDate(order.assignedAt)}` : "Biriktirish yo'q"}
              </span>
              <span className="text-base font-bold text-lazzat-maroon">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default AdminOrderList;
