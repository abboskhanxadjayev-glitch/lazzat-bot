import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createOrder } from "../api/client";
import OrderSummary from "../components/OrderSummary";
import PageHeader from "../components/PageHeader";
import { useCart } from "../context/CartContext";
import { useTelegram } from "../hooks/useTelegram";

function getInitialForm(displayName) {
  return {
    customerName: displayName === "Mehmon" ? "" : displayName,
    phone: "",
    address: "",
    notes: ""
  };
}

function CheckoutPage() {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const { user, displayName, webApp } = useTelegram();
  const [form, setForm] = useState(() => getInitialForm(displayName));
  const [error, setError] = useState("");
  const [orderResult, setOrderResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm((currentForm) =>
      currentForm.customerName
        ? currentForm
        : { ...currentForm, customerName: displayName === "Mehmon" ? "" : displayName }
    );
  }, [displayName]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        totalAmount: totalPrice,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity
        })),
        telegramUser: user
          ? {
              id: user.id,
              username: user.username || null,
              firstName: user.first_name || null,
              lastName: user.last_name || null
            }
          : null
      });

      setOrderResult(order);
      clearCart();
      webApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch (requestError) {
      setError(requestError.message);
      webApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (orderResult) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Tayyor"
          title="Buyurtma qabul qilindi"
          description="Operator tez orada siz bilan bog'lanadi."
        />

        <section className="surface-card bg-hero text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/65">
            Buyurtma raqami
          </p>
          <p className="mt-3 text-3xl font-bold">{orderResult.id}</p>
          <p className="mt-4 text-sm leading-6 text-white/80">
            Holati: {orderResult.status}. Yetkazib berish manzili tasdiqlangach,
            oshxonamiz sizga qayta yozadi yoki qo'ng'iroq qiladi.
          </p>
        </section>

        <Link to="/" className="primary-button w-full">
          Bosh sahifaga qaytish
        </Link>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Buyurtma"
          title="Avval savatni to'ldiring"
          description="Rasmiylashtirish uchun kamida bitta mahsulot qo'shilgan bo'lishi kerak."
        />

        <section className="surface-card text-center">
          <Link to="/" className="primary-button">
            Menyuga o'tish
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Checkout"
        title="Yetkazib berishni rasmiylashtiring"
        description="Ism, telefon va manzilni kiriting. Buyurtma backend orqali yuboriladi."
      />

      <OrderSummary totalItems={totalItems} totalPrice={totalPrice} />

      <form onSubmit={handleSubmit} className="surface-card space-y-4">
        <div>
          <label htmlFor="customerName" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Ism
          </label>
          <input
            id="customerName"
            name="customerName"
            className="field-input"
            placeholder="Masalan, Azizbek"
            value={form.customerName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            className="field-input"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="address" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Manzil
          </label>
          <textarea
            id="address"
            name="address"
            rows="3"
            className="field-input resize-none"
            placeholder="Mahalla, ko'cha, mo'ljal"
            value={form.address}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Izoh
          </label>
          <textarea
            id="notes"
            name="notes"
            rows="3"
            className="field-input resize-none"
            placeholder="Qo'shimcha istaklar bo'lsa yozing"
            value={form.notes}
            onChange={handleChange}
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Yuborilmoqda..." : "Buyurtmani yuborish"}
        </button>
      </form>
    </div>
  );
}

export default CheckoutPage;
