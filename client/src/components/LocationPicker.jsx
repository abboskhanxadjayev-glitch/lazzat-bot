import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { formatCurrency } from "../utils/formatCurrency";
import { RESTAURANT_LOCATION } from "../utils/delivery";

const restaurantPosition = [RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude];

const restaurantIcon = L.divIcon({
  className: "map-pin map-pin--restaurant",
  html: '<span class="map-pin__inner"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10]
});

const customerIcon = L.divIcon({
  className: "map-pin map-pin--customer",
  html: '<span class="map-pin__inner"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10]
});

function formatCoordinateValue(value) {
  if (value === "" || value === null || value === undefined) {
    return "Tanlanmagan";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : "Tanlanmagan";
}

function MapClickHandler({ onSelectLocation }) {
  useMapEvents({
    click(event) {
      onSelectLocation({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng
      });
    }
  });

  return null;
}

function MapViewport({ customerPosition }) {
  const map = useMap();

  useEffect(() => {
    if (customerPosition) {
      map.fitBounds([restaurantPosition, customerPosition], {
        padding: [32, 32],
        maxZoom: 16
      });
      return;
    }

    map.setView(restaurantPosition, 15);
  }, [customerPosition, map]);

  return null;
}

function LocationPicker({
  address,
  customerLat,
  customerLng,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
  locationError,
  hasValidCoordinates,
  distanceKm,
  deliveryFee
}) {
  useEffect(() => {
    console.log("[LocationPicker] mounted");
  }, []);

  const customerPosition = hasValidCoordinates
    ? [Number(customerLat), Number(customerLng)]
    : null;
  const selectedAddressText = address.trim() || "Matnli manzil hali kiritilmagan";

  return (
    <section className="surface-card space-y-4 bg-surface">
      <div>
        <p className="section-label">Joylashuv</p>
        <h3 className="mt-2 text-2xl font-bold text-lazzat-maroon">Xaritadan manzilni tanlang</h3>
        <p className="mt-2 text-sm leading-6 text-lazzat-ink/75">
          Xaritaga bosing va mijoz nuqtasini tanlang. Yetkazib berish masofasi va narxi
          shu nuqta bo'yicha avtomatik hisoblanadi.
        </p>
      </div>

      <div className="rounded-[28px] border border-lazzat-gold/25 bg-gradient-to-br from-white via-lazzat-cream/70 to-lazzat-gold/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-lazzat-red/70">
              Restoran nuqtasi
            </p>
            <p className="mt-2 text-lg font-bold text-lazzat-maroon">{RESTAURANT_LOCATION.name}</p>
            <p className="mt-1 text-sm leading-6 text-lazzat-ink/70">{RESTAURANT_LOCATION.address}</p>
          </div>
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="secondary-button shrink-0 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLocating ? "Aniqlanmoqda..." : "Joriy joylashuv"}
          </button>
        </div>

        <div
          className="checkout-map mt-4 overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-sm"
          style={{ height: "300px" }}
        >
          <div style={{ height: "300px" }}>
            <MapContainer
              center={restaurantPosition}
              zoom={15}
              scrollWheelZoom={false}
              style={{ height: "300px", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onSelectLocation={onSelectLocation} />
              <MapViewport customerPosition={customerPosition} />

              <Marker position={restaurantPosition} icon={restaurantIcon}>
                <Popup>
                  <strong>{RESTAURANT_LOCATION.name}</strong>
                  <br />
                  {RESTAURANT_LOCATION.address}
                </Popup>
              </Marker>

              {customerPosition ? (
                <Marker position={customerPosition} icon={customerIcon}>
                  <Popup>
                    <strong>Tanlangan manzil</strong>
                    <br />
                    Latitude: {Number(customerLat).toFixed(6)}
                    <br />
                    Longitude: {Number(customerLng).toFixed(6)}
                  </Popup>
                </Marker>
              ) : null}
            </MapContainer>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[20px] bg-white/80 px-4 py-3 text-lazzat-ink/75">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full bg-lazzat-maroon" />
              <span className="font-bold text-lazzat-maroon">Lazzat Oshxonasi</span>
            </div>
            <p className="mt-2 leading-6">Restoran nuqtasi xaritada doim ko'rinadi.</p>
          </div>
          <div className="rounded-[20px] bg-white/80 px-4 py-3 text-lazzat-ink/75">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full bg-lazzat-red" />
              <span className="font-bold text-lazzat-maroon">Mijoz manzili</span>
            </div>
            <p className="mt-2 leading-6">
              {hasValidCoordinates
                ? "Nuqta tanlandi. Xaritada boshqa joyni bossangiz marker ko'chadi."
                : "Tanlash uchun xaritada bir nuqtani bosing."}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-lazzat-gold/20 bg-white/85 p-4">
        <p className="section-label">Tanlangan manzil</p>
        <p className="mt-2 text-base font-bold text-lazzat-maroon">{selectedAddressText}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[20px] bg-lazzat-cream/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-lazzat-red/60">Latitude</p>
            <p className="mt-2 font-bold text-lazzat-maroon">{formatCoordinateValue(customerLat)}</p>
          </div>
          <div className="rounded-[20px] bg-lazzat-cream/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-lazzat-red/60">Longitude</p>
            <p className="mt-2 font-bold text-lazzat-maroon">{formatCoordinateValue(customerLng)}</p>
          </div>
        </div>

        {hasValidCoordinates ? (
          <div className="mt-4 flex items-center justify-between rounded-[22px] bg-lazzat-maroon px-4 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Masofa</p>
              <p className="mt-2 text-lg font-bold">{distanceKm.toFixed(2)} km</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Yetkazib berish</p>
              <p className="mt-2 text-lg font-bold">{formatCurrency(deliveryFee)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-lazzat-ink/70">Xaritadan manzilni tanlang</p>
        )}
      </div>

      {locationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {locationError}
        </div>
      ) : null}
    </section>
  );
}

export default LocationPicker;
