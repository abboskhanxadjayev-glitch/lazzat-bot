import { formatCurrency } from "../utils/formatCurrency";

function OrderSummary({ totalItems, totalPrice }) {
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
          <span>Mahsulotlar</span>
          <span className="font-bold">{formatCurrency(totalPrice)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Yetkazib berish</span>
          <span className="font-bold text-emerald-700">Bepul</span>
        </div>
        <div className="flex items-center justify-between border-t border-lazzat-gold/20 pt-3 text-base font-extrabold text-lazzat-maroon">
          <span>Jami</span>
          <span>{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </section>
  );
}

export default OrderSummary;
