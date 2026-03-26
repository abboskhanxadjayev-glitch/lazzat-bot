const COURIER_SESSION_STORAGE_KEY = "lazzat.courier.session";

function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getCourierSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(COURIER_SESSION_STORAGE_KEY);
  const parsedValue = safeParseJson(storedValue);

  if (!parsedValue?.token) {
    return null;
  }

  return {
    token: parsedValue.token,
    courier: parsedValue.courier || null,
    savedAt: parsedValue.savedAt || null
  };
}

export function setCourierSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session?.token) {
    clearCourierSession();
    return;
  }

  window.localStorage.setItem(
    COURIER_SESSION_STORAGE_KEY,
    JSON.stringify({
      token: session.token,
      courier: session.courier || null,
      savedAt: new Date().toISOString()
    })
  );
}

export function clearCourierSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COURIER_SESSION_STORAGE_KEY);
}

export function getCourierAuthToken() {
  return getCourierSession()?.token || "";
}
