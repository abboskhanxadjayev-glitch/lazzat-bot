export const RESTAURANT_LOCATION = {
  name: "Lazzat Oshxonasi",
  address: "7R65+GMJ, Tinchlik ko'chasi, Yangiyer, Sirdaryo viloyati",
  latitude: 40.275,
  longitude: 68.8225
};

export const DELIVERY_RATE_PER_KM = 5000;
const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function parseCoordinate(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
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