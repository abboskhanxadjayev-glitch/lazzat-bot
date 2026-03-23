import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCategories, getProducts } from "../api/client";
import PageHeader from "../components/PageHeader";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";

function ProductsPage() {
  const { categorySlug } = useParams();
  const { addItem } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        const [categoryData, productData] = await Promise.all([
          getCategories(),
          getProducts({ categorySlug })
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(categoryData);
        setProducts(productData);
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

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, [categorySlug]);

  const activeCategory = categories.find((category) => category.slug === categorySlug);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mahsulotlar"
        title={activeCategory?.name || "Kategoriyadagi taomlar"}
        description={
          activeCategory?.description ||
          "Kategoriya bo'yicha mahsulotlar shu sahifada ko'rsatiladi."
        }
      />

      <section className="surface-card overflow-hidden p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/categories/${category.slug}`}
              className={[
                "whitespace-nowrap rounded-full px-4 py-3 text-sm font-bold transition",
                category.slug === categorySlug
                  ? "bg-lazzat-red text-white"
                  : "bg-lazzat-cream text-lazzat-maroon"
              ].join(" ")}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-[28px] bg-white/70 shadow-lazzat"
            />
          ))}
        </div>
      ) : error ? (
        <section className="surface-card text-sm text-red-700">{error}</section>
      ) : products.length === 0 ? (
        <section className="surface-card">
          <p className="text-sm leading-6 text-lazzat-ink/75">
            Bu kategoriyada mahsulot topilmadi. Boshqa bo'limni tanlab ko'ring.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addItem} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsPage;
