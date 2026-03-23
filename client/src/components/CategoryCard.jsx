import { Link } from "react-router-dom";

function CategoryCard({ category }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="surface-card block animate-floatUp overflow-hidden bg-surface"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Bo'lim</p>
          <h3 className="mt-2 text-2xl font-bold text-lazzat-maroon">
            {category.name}
          </h3>
          <p className="mt-2 max-w-[16rem] text-sm leading-6 text-lazzat-ink/75">
            {category.description}
          </p>
        </div>
        <div className="rounded-[24px] bg-lazzat-maroon px-4 py-3 text-right text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Taomlar</p>
          <p className="mt-2 text-2xl font-extrabold">{category.productCount}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="rounded-full bg-lazzat-gold/20 px-3 py-2 text-xs font-bold text-lazzat-maroon">
          Hoziroq tanlash
        </span>
        <span className="text-sm font-bold text-lazzat-red">Ochish</span>
      </div>
    </Link>
  );
}

export default CategoryCard;
