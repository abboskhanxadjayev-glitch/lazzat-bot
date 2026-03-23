const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

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
    throw new Error(payload.message || "So'rovni bajarib bo'lmadi.");
  }

  return payload.data;
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

export function createOrder(order) {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify(order)
  });
}
