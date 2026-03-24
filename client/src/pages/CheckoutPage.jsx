import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder } from "../api/client";
import CheckoutForm from "../components/CheckoutForm";
import LocationPicker from "../components/LocationPicker";
import OrderSummary from "../components/OrderSummary";
import PageHeader from "../components/PageHeader";
import { useCartActions, useCartState } from "../context/CartContext";
import { useTelegram } from "../hooks/useTelegram";
import {
  RESTAURANT_LOCATION,
  calculateDeliveryFee,
  calculateDistanceKm,
  isValidLatitude,
  isValidLongitude,
  roundDistanceKm
} from "../utils/delivery";
import { formatCurrency } from "../utils/formatCurrency";

function getInitialForm(displayName) {
  return {
    customerName: displayName === "Mehmon" ? "" : displayName,
    phone: "",
    address: "",
    notes: ""
  };
}

function formatCoordinateDisplay(value) {
  if (value === null || value === undefined || value === "") {
    return "Noma'lum";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : "Noma'lum";
}

function formatDistanceDisplay(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2)} km` : "Noma'lum";
}

function CheckoutPage() {
  console.count("CheckoutPage render");

  const navigate = useNavigate();
  const { cartItems, totalItems, totalPrice } = useCartState();
  const { clearCart } = useCartActions();
  const { user, displayName, webApp } = useTelegram();
  const [form, setForm] = useState(() => getInitialForm(displayName));
  const [selectedLocation, setSelectedLocation] = useState(null);
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

  const restaurantOrigin = useMemo(() => RESTAURANT_LOCATION, []);
  const customerLat = selectedLocation?.lat ?? null;
  const customerLng = selectedLocation?.lng ?? null;
  const hasValidCoordinates =
    isValidLatitude(customerLat) && isValidLongitude(customerLng);
  const deliveryDistanceKm = useMemo(() => {
    if (!hasValidCoordinates) {
      return null;
    }

    return roundDistanceKm(
      calculateDistanceKm(restaurantOrigin, {
        latitude: customerLat,
        longitude: customerLng
      })
    );
  }, [customerLat, customerLng, hasValidCoordinates, restaurantOrigin]);
  const deliveryFee = useMemo(
    () => (deliveryDistanceKm !== null ? calculateDeliveryFee(deliveryDistanceKm) : 0),
    [deliveryDistanceKm]
  );
  const totalAmount = useMemo(() => totalPrice + deliveryFee, [deliveryFee, totalPrice]);
  const isSubmitDisabled = isSubmitting || !hasValidCoordinates;

  const handleFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }, []);

  const handleLocationSelect = useCallback(
    (lat, lng) => {
      setSelectedLocation({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      });
      setLocationError("");
      setError("");
      webApp?.HapticFeedback?.impactOccurred?.("light");
    },
    [webApp]
  );

  const handleUseCurrentLocation = useCallback(() => {
    setLocationError("");
    setError("");

    if (!navigator.geolocation) {
      setLocationError("Brauzer geolokatsiyani qo'llab-quvvatlamaydi.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationSelect(position.coords.latitude, position.coords.longitude);
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
  }, [handleLocationSelect]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLocationError("");

    const locationToSubmit = selectedLocation ? { ...selectedLocation } : null;

    if (!locationToSubmit || !hasValidCoordinates || deliveryDistanceKm === null) {
      setError("Xaritadan manzilni tanlang");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        customerLat: locationToSubmit.lat,
        customerLng: locationToSubmit.lng,
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
      };

      console.log("Selected location:", locationToSubmit);
      console.log("Final payload:", payload);

      const order = await createOrder(payload);

      if (!order?.id) {
        throw new Error("Server busy, try again");
      }

      startTransition(() => {
        setOrderResult(order);
        clearCart();
      });
      webApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch (requestError) {
      console.error("Order submit error", requestError);
      setError(requestError?.message || "Buyurtmani yuborib bo'lmadi.");
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
              <span className="font-bold">{formatDistanceDisplay(orderResult.deliveryDistanceKm)}</span>
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
            Latitude: {formatCoordinateDisplay(orderResult.customerLat)} | Longitude: {formatCoordinateDisplay(orderResult.customerLng)}
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="secondary-button w-full"
          >
            Buyurtmalarimni ko'rish
          </button>
          <Link to="/" className="primary-button w-full">
            Bosh sahifaga qaytish
          </Link>
        </div>
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
        <CheckoutForm form={form} onFieldChange={handleFieldChange} />

        <LocationPicker
          restaurantOrigin={restaurantOrigin}
          selectedLocation={selectedLocation}
          onLocationSelect={handleLocationSelect}
          onUseCurrentLocation={handleUseCurrentLocation}
          isLocating={isLocating}
          locationError={locationError}
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
              onChange={handleFieldChange}
            />
          </div>

          {isSubmitting ? (
            <div className="rounded-2xl border border-lazzat-gold/25 bg-lazzat-cream/70 px-4 py-3 text-sm text-lazzat-maroon">
              <span className="inline-flex items-center gap-3 font-medium">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-lazzat-red/25 border-t-lazzat-red" />
                Buyurtma yuborilmoqda...
              </span>
            </div>
          ) : null}

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
            aria-busy={isSubmitting}
            className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Yuborilmoqda...
              </span>
            ) : (
              `Buyurtmani ${formatCurrency(totalAmount)} ga yuborish`
            )}
          </button>
        </section>
      </form>
    </div>
  );
}

export default CheckoutPage;