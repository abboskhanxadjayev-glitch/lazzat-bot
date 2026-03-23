import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createOrder } from "../api/client";
import LocationPicker from "../components/LocationPicker";
import OrderSummary from "../components/OrderSummary";
import PageHeader from "../components/PageHeader";
import { useCart } from "../context/CartContext";
import { useTelegram } from "../hooks/useTelegram";
import {
  RESTAURANT_LOCATION,
  calculateDeliveryFee,
  calculateDistanceKm,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  roundDistanceKm
} from "../utils/delivery";
import { formatCurrency } from "../utils/formatCurrency";

function getInitialForm(displayName) {
  return {
    customerName: displayName === "Mehmon" ? "" : displayName,
    phone: "",
    address: "",
    notes: "",
    customerLat: "",
    customerLng: ""
  };
}

function CheckoutPage() {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const { user, displayName, webApp } = useTelegram();
  const [form, setForm] = useState(() => getInitialForm(displayName));
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [orderResult, setOrderResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    setForm((currentForm) =>
      currentForm.customerName
        ? currentForm
        : { ...currentForm, customerName: displayName === "Mehmon" ? "" : displayName }
    );
  }, [displayName]);

  const parsedCustomerLat = parseCoordinate(form.customerLat);
  const parsedCustomerLng = parseCoordinate(form.customerLng);
  const hasValidCoordinates =
    isValidLatitude(parsedCustomerLat) && isValidLongitude(parsedCustomerLng);
  const deliveryDistanceKm = hasValidCoordinates
    ? roundDistanceKm(
        calculateDistanceKm(RESTAURANT_LOCATION, {
          latitude: parsedCustomerLat,
          longitude: parsedCustomerLng
        })
      )
    : null;
  const deliveryFee = deliveryDistanceKm !== null ? calculateDeliveryFee(deliveryDistanceKm) : 0;
  const totalAmount = totalPrice + deliveryFee;
  const isSubmitDisabled = isSubmitting || !hasValidCoordinates;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function handleAddressChange(event) {
    handleChange(event);
  }

  function handleMapSelect({ latitude, longitude }) {
    setForm((currentForm) => ({
      ...currentForm,
      customerLat: latitude.toFixed(6),
      customerLng: longitude.toFixed(6)
    }));
    setLocationError("");
    setError("");
    webApp?.HapticFeedback?.impactOccurred?.("light");
  }

  function handleUseCurrentLocation() {
    setLocationError("");
    setError("");

    if (!navigator.geolocation) {
      setLocationError("Brauzer geolokatsiyani qo'llab-quvvatlamaydi.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleMapSelect({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsLocating(false);
      },
      () => {
        setLocationError("Joylashuvni aniqlab bo'lmadi. Xaritadan manzilni tanlang.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLocationError("");

    if (!hasValidCoordinates || deliveryDistanceKm === null) {
      setError("Xaritadan manzilni tanlang");
      return;
    }

    setIsSubmitting(true);

    try {
      const order = await createOrder({
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        customerLat: parsedCustomerLat,
        customerLng: parsedCustomerLng,
        deliveryDistanceKm,
        deliveryFee,
        totalAmount,
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
          description="Operator tez orada siz bilan bog'lanadi. Yetkazib berish masofasi hisoblab saqlandi."
        />

        <section className="surface-card bg-hero text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/65">Buyurtma raqami</p>
          <p className="mt-3 text-3xl font-bold">{orderResult.id}</p>
          <p className="mt-4 text-sm leading-6 text-white/80">
            Holati: {orderResult.status}. Buyurtma summasi va yetkazib berish narxi
            hisoblanib, oshxonaga yuborildi.
          </p>
        </section>

        <section className="surface-card bg-surface">
          <div className="space-y-3 text-sm text-lazzat-ink/80">
            <div className="flex items-center justify-between">
              <span>Mahsulotlar summasi</span>
              <span className="font-bold">{formatCurrency(orderResult.subtotalAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Yetkazib berish narxi</span>
              <span className="font-bold">{formatCurrency(orderResult.deliveryFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Masofa</span>
              <span className="font-bold">{orderResult.deliveryDistanceKm.toFixed(2)} km</span>
            </div>
            <div className="flex items-center justify-between border-t border-lazzat-gold/20 pt-3 text-base font-extrabold text-lazzat-maroon">
              <span>Jami</span>
              <span>{formatCurrency(orderResult.totalAmount)}</span>
            </div>
          </div>
        </section>

        <section className="surface-card">
          <p className="section-label">Yetkazib berish manzili</p>
          <p className="mt-2 text-base font-bold text-lazzat-maroon">{orderResult.address}</p>
          <p className="mt-2 text-sm leading-6 text-lazzat-ink/70">
            Latitude: {orderResult.customerLat.toFixed(6)} | Longitude: {orderResult.customerLng.toFixed(6)}
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
        description="Ism, telefon, manzil va xaritadagi nuqtani tanlang. Narx masofaga qarab hisoblanadi."
      />

      <OrderSummary
        totalItems={totalItems}
        subtotal={totalPrice}
        deliveryFee={deliveryFee}
        totalAmount={totalAmount}
        distanceKm={deliveryDistanceKm}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="surface-card space-y-4">
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
        </section>

        <section className="surface-card space-y-4">
          <div>
            <label htmlFor="address" className="mb-2 block text-sm font-bold text-lazzat-maroon">
              Yetkazib berish manzili
            </label>
            <textarea
              id="address"
              name="address"
              rows="3"
              className="field-input resize-none"
              placeholder="Mahalla, ko'cha, uy raqami va mo'ljal"
              value={form.address}
              onChange={handleAddressChange}
              required
            />
          </div>
        </section>

        <LocationPicker
          address={form.address}
          customerLat={form.customerLat}
          customerLng={form.customerLng}
          onSelectLocation={handleMapSelect}
          onUseCurrentLocation={handleUseCurrentLocation}
          isLocating={isLocating}
          locationError={locationError}
          hasValidCoordinates={hasValidCoordinates}
          distanceKm={deliveryDistanceKm ?? 0}
          deliveryFee={deliveryFee}
        />

        <section className="surface-card space-y-4">
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

          {!hasValidCoordinates ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Xaritadan manzilni tanlang
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Yuborilmoqda..." : `Buyurtmani ${formatCurrency(totalAmount)} ga yuborish`}
          </button>
        </section>
      </form>
    </div>
  );
}

export default CheckoutPage;
