import { memo } from "react";
import { Link } from "react-router-dom";
import OrderSummary from "./OrderSummary";

const CartSummary = memo(function CartSummary({ totalItems, totalPrice }) {
  console.count("CartSummary render");

  return (
    <>
      <OrderSummary
        totalItems={totalItems}
        subtotal={totalPrice}
        deliveryFee={0}
        totalAmount={totalPrice}
        distanceKm={null}
      />

      <div className="flex gap-3">
        <Link to="/" className="secondary-button flex-1">
          Yana tanlash
        </Link>
        <Link to="/checkout" className="primary-button flex-1">
          Rasmiylashtirish
        </Link>
      </div>
    </>
  );
});

export default CartSummary;