export const RESTAURANT_LOCATION = {
  name: "Lazzat Oshxonasi",
  address: "7R65+GMJ, Tinchlik ko‘chasi, Yangiyer, Sirdaryo viloyati",
  latitude: 40.261318,
  longitude: 68.809088
};

export const DELIVERY_RATE_PER_KM = 5000;
const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function roundDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }

  return Math.round(distanceKm * 100) / 100;
}

export function calculateDistanceKm(origin, destination) {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_KM * angularDistance;
}

export function calculateDeliveryFee(distanceKm) {
  const normalizedDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  return Math.ceil(normalizedDistance) * DELIVERY_RATE_PER_KM;
}

export function getDeliveryDetails(payload) {
  const hasCoordinates =
    Number.isFinite(payload.customerLat) && Number.isFinite(payload.customerLng);
  const customerLat = hasCoordinates ? Number(payload.customerLat) : null;
  const customerLng = hasCoordinates ? Number(payload.customerLng) : null;
  const distanceFromCoordinates = hasCoordinates
    ? roundDistanceKm(
        calculateDistanceKm(RESTAURANT_LOCATION, {
          latitude: customerLat,
          longitude: customerLng
        })
      )
    : null;
  const fallbackDistance = roundDistanceKm(Number(payload.deliveryDistanceKm || 0));
  const deliveryDistanceKm = distanceFromCoordinates ?? fallbackDistance;
  const deliveryFee = calculateDeliveryFee(deliveryDistanceKm);

  return {
    customerLat,
    customerLng,
    deliveryDistanceKm,
    deliveryFee,
    restaurantLocation: RESTAURANT_LOCATION
  };
}
