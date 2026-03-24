import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api/client";
import CategoryCard from "../components/CategoryCard";
import PageHeader from "../components/PageHeader";
import { useCartState } from "../context/CartContext";
import { highlights } from "../data/highlights";
import { formatCurrency } from "../utils/formatCurrency";

function HomePage() {
  console.count("HomePage render");

  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { totalItems, totalPrice } = useCartState();

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const data = await getCategories();

        if (isMounted) {
          setCategories(data);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const firstCategory = categories[0];

  return (
    <div className="space-y-5">
      <section className="surface-card overflow-hidden bg-hero text-white">
        <p className="text-xs uppercase tracking-[0.28em] text-white/60">
          Mini App MVP
        </p>
        <h1 className="mt-3 text-4xl font-bold">Milliy lazzat bir necha bosishda</h1>
        <p className="mt-3 max-w-[18rem] text-sm leading-6 text-white/80">
          Kategoriyadan tanlang, savatga qo'shing va buyurtmani Telegram ichida yuboring.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur"
            >
              <p className="text-sm font-extrabold">{item.value}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/70">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <Link
            to={firstCategory ? `/categories/${firstCategory.slug}` : "/"}
            className="rounded-full bg-white px-5 py-3 text-sm font-bold text-lazzat-maroon"
          >
            Menyuni ochish
          </Link>
          <Link
            to="/cart"
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white"
          >
            Savatga o'tish
          </Link>
        </div>
      </section>

      {totalItems > 0 ? (
        <section className="surface-card flex items-center justify-between gap-4 bg-white">
          <div>
            <p className="section-label">Faol buyurtma</p>
            <p className="mt-2 text-lg font-bold text-lazzat-maroon">
              {totalItems} ta mahsulot savatda
            </p>
            <p className="mt-1 text-sm text-lazzat-ink/70">
              Jami: {formatCurrency(totalPrice)}
            </p>
          </div>
          <Link to="/checkout" className="primary-button">
            Yakunlash
          </Link>
        </section>
      ) : null}

      <PageHeader
        eyebrow="Kategoriya"
        title="Taom bo'limlari"
        description="Yangilangan menyuda 8 ta asosiy kategoriya va 81 ta mahsulot ko'rsatiladi."
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-[28px] bg-white/70 shadow-lazzat"
            />
          ))}
        </div>
      ) : error ? (
        <section className="surface-card text-sm text-red-700">{error}</section>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}

export default HomePage;