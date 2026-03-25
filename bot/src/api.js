const DEFAULT_API_ORIGIN = "https://lazzat-bot.onrender.com";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function withApiPrefix(value) {
  return value.endsWith("/api") ? value : `${value}/api`;
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_API_URL || DEFAULT_API_ORIGIN;
  return withApiPrefix(trimTrailingSlash(configuredBaseUrl));
}

function createApiError(response, payload, fallbackMessage) {
  const error = new Error(payload.message || fallbackMessage);
  error.statusCode = response.status;
  error.details = payload.details || null;
  return error;
}

const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createApiError(response, payload, "So'rovni bajarib bo'lmadi.");
  }

  return payload.data;
}

export function ensureCourier(telegramUser) {
  return request("/couriers/ensure", {
    method: "POST",
    body: JSON.stringify({ telegramUser })
  });
}

export function getCourierProfile(telegramUserId) {
  return request("/couriers/me", {
    headers: {
      "x-telegram-user-id": String(telegramUserId)
    }
  });
}

export function updateCourierProfile(courierId, payload) {
  return request(`/couriers/${courierId}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateCourierOnlineStatus(courierId, onlineStatus) {
  return request(`/couriers/${courierId}/online-status`, {
    method: "PATCH",
    body: JSON.stringify({ onlineStatus })
  });
}

export { API_BASE_URL };
