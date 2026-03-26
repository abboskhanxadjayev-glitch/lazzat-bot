import { getTelegramHeaders } from "../utils/telegramWebApp";

const LOCAL_API_ORIGIN = "http://localhost:5000";
const PRODUCTION_API_ORIGIN = "https://lazzat-bot.onrender.com";

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function withApiPrefix(value) {
  if (value === "/api" || value.endsWith("/api")) {
    return value;
  }

  return `${value}/api`;
}

function isLocalApiUrl(value) {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function isLocalClient() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredBaseUrl) {
    const normalizedBaseUrl = withApiPrefix(trimTrailingSlash(configuredBaseUrl));

    if (!isLocalClient() && isLocalApiUrl(normalizedBaseUrl)) {
      return `${PRODUCTION_API_ORIGIN}/api`;
    }

    return normalizedBaseUrl;
  }

  return isLocalClient() ? `${LOCAL_API_ORIGIN}/api` : `${PRODUCTION_API_ORIGIN}/api`;
}

function mergeAbortSignals(...signals) {
  const activeSignals = signals.filter(Boolean);

  if (!activeSignals.length) {
    return null;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();

  function abortFrom(sourceSignal) {
    if (controller.signal.aborted) {
      return;
    }

    controller.abort(sourceSignal.reason);
  }

  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abortFrom(signal);
      return;
    }

    signal.addEventListener("abort", () => abortFrom(signal), { once: true });
  });

  return controller.signal;
}

function createRequestError(response, payload, fallbackMessage) {
  const error = new Error(payload.message || fallbackMessage);
  error.statusCode = response.status;
  error.details = payload.details || null;
  return error;
}

function withTelegramIdentityHeaders(telegramUserId, headers = {}) {
  return {
    ...getTelegramHeaders(telegramUserId),
    ...headers
  };
}

function withCourierAuthHeaders(authToken, headers = {}) {
  if (!authToken) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${authToken}`
  };
}

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 12000;

async function request(path, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers = {},
    signal: externalSignal,
    ...requestOptions
  } = options;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      signal: mergeAbortSignals(timeoutController.signal, externalSignal),
      ...requestOptions
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw createRequestError(response, payload, "So'rovni bajarib bo'lmadi.");
    }

    return payload.data;
  } catch (error) {
    if (timeoutController.signal.aborted) {
      const timeoutError = new Error("Server busy, try again");
      timeoutError.statusCode = 408;
      timeoutError.details = { code: "REQUEST_TIMEOUT" };
      throw timeoutError;
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getCategories(options = {}) {
  return request("/categories", options);
}

export function getProducts(filters = {}, options = {}) {
  const params = new URLSearchParams();

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.categorySlug) {
    params.set("categorySlug", filters.categorySlug);
  }

  const query = params.toString();
  return request(`/products${query ? `?${query}` : ""}`, options);
}

export function getOrders(options = {}) {
  return request("/orders", options);
}

export function getMyOrders(telegramUserId = null, options = {}) {
  return request("/orders/my-orders", {
    ...options,
    headers: withTelegramIdentityHeaders(telegramUserId, options.headers || {})
  });
}

export function getCourierPortalOrders(authToken, options = {}) {
  return request("/orders/my-orders", {
    ...options,
    headers: withCourierAuthHeaders(authToken, options.headers || {})
  });
}

export function getOrderById(orderId, options = {}) {
  return request(`/orders/${orderId}`, options);
}

export function updateOrderStatus(orderId, status, options = {}) {
  return request(`/orders/${orderId}/status`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function assignCourierToOrder(orderId, courierId, options = {}) {
  return request(`/orders/${orderId}/courier`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ courierId: courierId || null })
  });
}

export function getCouriers(filters = {}, options = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  const query = params.toString();
  return request(`/couriers${query ? `?${query}` : ""}`, options);
}

export function getCourierProfile(telegramUserId = null, options = {}) {
  return request("/couriers/me", {
    ...options,
    headers: withTelegramIdentityHeaders(telegramUserId, options.headers || {})
  });
}

export function getCourierPortalProfile(authToken, options = {}) {
  return request("/couriers/me", {
    ...options,
    headers: withCourierAuthHeaders(authToken, options.headers || {})
  });
}

export function getCourierOrders(telegramUserId = null, options = {}) {
  return request("/couriers/me/orders", {
    ...options,
    headers: withTelegramIdentityHeaders(telegramUserId, options.headers || {})
  });
}

export function registerCourier(payload, options = {}) {
  return request("/couriers/register", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateCourierStatus(courierId, status, options = {}) {
  return request(`/couriers/${courierId}/status`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function loginCourier(credentials, options = {}) {
  return request("/courier/login", {
    ...options,
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function updateCourierPortalOnlineStatus(authToken, onlineStatus, options = {}) {
  return request("/couriers/online", {
    ...options,
    method: "PATCH",
    headers: withCourierAuthHeaders(authToken, options.headers || {}),
    body: JSON.stringify({ onlineStatus })
  });
}

export function createOrder(order, options = {}) {
  return request("/orders", {
    ...options,
    method: "POST",
    headers: withTelegramIdentityHeaders(order?.telegramUser?.id || null, options.headers || {}),
    body: JSON.stringify(order),
    timeoutMs: options.timeoutMs || 12000
  });
}

export { API_BASE_URL };
