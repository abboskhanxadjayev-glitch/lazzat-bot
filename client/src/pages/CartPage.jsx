import { Link } from "react-router-dom";
import CartItem from "../components/CartItem";
import CartSummary from "../components/CartSummary";
import PageHeader from "../components/PageHeader";
import { useCartActions, useCartState } from "../context/CartContext";

function CartPage() {
  console.count("CartPage render");

  const { cartItems, totalItems, totalPrice } = useCartState();
  const { addItem, decrementItem, removeItem } = useCartActions();

  if (cartItems.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Savat"
          title="Savat hozircha bo'sh"
          description="Taom tanlang, keyin shu yerda buyurtmangizni ko'rasiz."
        />

        <section className="surface-card text-center">
          <p className="text-sm leading-6 text-lazzat-ink/75">
            Yangi tayyorlangan osh, manti yoki ichimlik tanlash uchun menyuga
            qayting.
          </p>
          <Link to="/" className="primary-button mt-5">
            Menyuga qaytish
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Savat"
        title="Buyurtmangiz tayyor"
        description="Miqdorni tekshiring, kerak bo'lsa o'zgartiring va davom eting."
      />

      <div className="space-y-4">
        {cartItems.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onAdd={addItem}
            onDecrease={decrementItem}
            onRemove={removeItem}
          />
        ))}
      </div>

      <CartSummary totalItems={totalItems} totalPrice={totalPrice} />
    </div>
  );
}

export default CartPage;