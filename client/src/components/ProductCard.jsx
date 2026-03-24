import { memo, useCallback } from "react";
import { formatCurrency } from "../utils/formatCurrency";

const ProductCard = memo(function ProductCard({ product, onAdd }) {
  const handleAdd = useCallback(() => {
    onAdd(product);
  }, [onAdd, product]);

  return (
    <article className="surface-card overflow-hidden p-0">
      <div className="bg-hero px-5 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/65">
          {product.categoryName}
        </p>
        <h3 className="mt-3 text-2xl font-bold">{product.name}</h3>
      </div>

      <div className="p-5">
        <p className="text-sm leading-6 text-lazzat-ink/75">{product.description}</p>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-lazzat-red/70">
              Narx
            </p>
            <p className="mt-1 text-xl font-extrabold text-lazzat-maroon">
              {formatCurrency(product.price)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="primary-button px-4 py-2.5"
          >
            Savatga
          </button>
        </div>
      </div>
    </article>
  );
});

export default ProductCard;