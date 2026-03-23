import { Link } from "react-router-dom";
import CartItem from "../components/CartItem";
import OrderSummary from "../components/OrderSummary";
import PageHeader from "../components/PageHeader";
import { useCart } from "../context/CartContext";

function CartPage() {
  const {
    cartItems,
    addItem,
    decrementItem,
    removeItem,
    totalItems,
    totalPrice
  } = useCart();

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

      <OrderSummary totalItems={totalItems} totalPrice={totalPrice} />

      <div className="flex gap-3">
        <Link to="/" className="secondary-button flex-1">
          Yana tanlash
        </Link>
        <Link to="/checkout" className="primary-button flex-1">
          Rasmiylashtirish
        </Link>
      </div>
    </div>
  );
}

export default CartPage;
