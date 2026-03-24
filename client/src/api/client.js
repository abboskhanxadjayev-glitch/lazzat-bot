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

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 12000;

async function request(path, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, ...requestOptions } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      signal: controller.signal,
      ...requestOptions
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "So'rovni bajarib bo'lmadi.");
    }

    return payload.data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Server busy, try again");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getCategories() {
  return request("/categories");
}

export function getProducts(filters = {}) {
  const params = new URLSearchParams();

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.categorySlug) {
    params.set("categorySlug", filters.categorySlug);
  }

  const query = params.toString();
  return request(`/products${query ? `?${query}` : ""}`);
}

export function getOrders() {
  return request("/orders");
}

export function getOrderById(orderId) {
  return request(`/orders/${orderId}`);
}

export function updateOrderStatus(orderId, status) {
  return request(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function createOrder(order) {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify(order),
    timeoutMs: 12000
  });
}

export { API_BASE_URL };