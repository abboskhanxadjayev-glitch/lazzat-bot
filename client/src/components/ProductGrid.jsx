import { memo } from "react";
import ProductCard from "./ProductCard";

const ProductGrid = memo(function ProductGrid({ products, onAdd }) {
  console.count("ProductGrid render");

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} />
      ))}
    </div>
  );
});

export default ProductGrid;