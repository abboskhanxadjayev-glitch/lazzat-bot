import { memo } from "react";
import { formatCurrency } from "../utils/formatCurrency";

const OrderSummary = memo(function OrderSummary({
  totalItems,
  subtotal,
  deliveryFee,
  totalAmount,
  distanceKm
}) {
  console.count("OrderSummary render");

  return (
    <section className="surface-card bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Savat</p>
          <h3 className="mt-2 text-2xl font-bold text-lazzat-maroon">
            Buyurtma xulosasi
          </h3>
        </div>
        <span className="rounded-full bg-lazzat-gold/20 px-3 py-2 text-xs font-bold text-lazzat-maroon">
          {totalItems} ta mahsulot
        </span>
      </div>

      <div className="mt-5 space-y-3 text-sm text-lazzat-ink/80">
        <div className="flex items-center justify-between">
          <span>Mahsulotlar summasi</span>
          <span className="font-bold">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Yetkazib berish narxi</span>
          <span className="font-bold">{formatCurrency(deliveryFee)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Hisoblangan masofa</span>
          <span className="font-bold">
            {distanceKm !== null ? `${distanceKm.toFixed(2)} km` : "Tanlanmagan"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-lazzat-gold/20 pt-3 text-base font-extrabold text-lazzat-maroon">
          <span>Jami</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </section>
  );
});

export default OrderSummary;