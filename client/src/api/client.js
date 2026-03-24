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
      throw new Error(payload.message || "So'rovni bajarib bo'lmadi.");
    }

    return payload.data;
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new Error("Server busy, try again");
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

export function getMyOrders(telegramUserId, options = {}) {
  return request("/orders/my-orders", {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-telegram-user-id": String(telegramUserId)
    }
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

export function createOrder(order, options = {}) {
  return request("/orders", {
    ...options,
    method: "POST",
    body: JSON.stringify(order),
    timeoutMs: options.timeoutMs || 12000
  });
}

export { API_BASE_URL };
