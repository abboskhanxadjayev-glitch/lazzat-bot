import { memo, useCallback } from "react";
import { formatCurrency } from "../utils/formatCurrency";

const CartItem = memo(function CartItem({ item, onAdd, onDecrease, onRemove }) {
  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  const handleDecrease = useCallback(() => {
    onDecrease(item.id);
  }, [item.id, onDecrease]);

  const handleAdd = useCallback(() => {
    onAdd(item);
  }, [item, onAdd]);

  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold text-lazzat-maroon">{item.name}</p>
          <p className="mt-1 text-sm text-lazzat-ink/70">{item.description}</p>
          <p className="mt-3 text-sm font-bold text-lazzat-red">
            {formatCurrency(item.price)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="rounded-full border border-lazzat-red/15 px-3 py-1 text-xs font-bold text-lazzat-red"
        >
          Olib tashlash
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="inline-flex items-center rounded-full border border-lazzat-gold/25 bg-lazzat-cream px-2 py-1">
          <button
            type="button"
            onClick={handleDecrease}
            className="h-9 w-9 rounded-full bg-white text-lg font-bold text-lazzat-maroon"
          >
            -
          </button>
          <span className="min-w-10 text-center text-sm font-extrabold text-lazzat-maroon">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            className="h-9 w-9 rounded-full bg-lazzat-red text-lg font-bold text-white"
          >
            +
          </button>
        </div>

        <p className="text-base font-extrabold text-lazzat-maroon">
          {formatCurrency(item.quantity * item.price)}
        </p>
      </div>
    </article>
  );
});

export default CartItem;