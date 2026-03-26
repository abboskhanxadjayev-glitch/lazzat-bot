import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearCourierSession,
  getCourierSession,
  setCourierSession
} from "../utils/courierPortalAuth";

export function useCourierSession() {
  const [session, setSessionState] = useState(() => getCourierSession());

  useEffect(() => {
    function handleStorage(event) {
      if (event.key && event.key !== "lazzat.courier.session") {
        return;
      }

      setSessionState(getCourierSession());
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveSession = useCallback((nextSession) => {
    setCourierSession(nextSession);
    setSessionState(getCourierSession());
  }, []);

  const clearSession = useCallback(() => {
    clearCourierSession();
    setSessionState(null);
  }, []);

  return useMemo(() => ({
    session,
    token: session?.token || "",
    courier: session?.courier || null,
    isAuthenticated: Boolean(session?.token),
    saveSession,
    clearSession
  }), [clearSession, saveSession, session]);
}
