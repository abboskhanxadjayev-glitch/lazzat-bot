import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrders } from "../api/client";
import { getSupabaseBrowserClient, hasSupabaseRealtimeConfig } from "../utils/supabaseBrowser";

const POLLING_INTERVAL_MS = 5000;
const REALTIME_REFRESH_DEBOUNCE_MS = 400;

function createLiveTimestamp() {
  return new Date();
}

export function formatLastUpdated(value) {
  if (!value) {
    return "Sinxronlanmoqda...";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

export function useLiveOrders() {
  const [orders, setOrders] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [liveMode, setLiveMode] = useState(hasSupabaseRealtimeConfig ? "connecting" : "polling");

  const mountedRef = useRef(false);
  const fetchStateRef = useRef({
    inFlight: false,
    queued: false,
    controller: null
  });
  const pollingIntervalRef = useRef(null);
  const realtimeRefreshTimeoutRef = useRef(null);
  const supabaseChannelRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const stampLastUpdated = useCallback(() => {
    const timestamp = createLiveTimestamp();
    setLastUpdatedAt(timestamp);
  }, []);

  const runFetch = useCallback(async ({ showLoading = false } = {}) => {
    if (!mountedRef.current) {
      return;
    }

    if (fetchStateRef.current.inFlight) {
      fetchStateRef.current.queued = true;
      return;
    }

    const controller = new AbortController();
    fetchStateRef.current.inFlight = true;
    fetchStateRef.current.queued = false;
    fetchStateRef.current.controller = controller;

    if (showLoading) {
      setIsInitialLoading(true);
    }

    try {
      const nextOrders = await getOrders({ signal: controller.signal });

      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      setOrders(nextOrders);
      setError("");
      setLastUpdatedAt(createLiveTimestamp());
      hasLoadedOnceRef.current = true;
    } catch (requestError) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      console.error("[live-orders] fetch error", requestError);

      if (!hasLoadedOnceRef.current) {
        setError(requestError.message || "Buyurtmalarni yuklab bo'lmadi.");
      }
    } finally {
      if (!mountedRef.current) {
        return;
      }

      if (fetchStateRef.current.controller === controller) {
        fetchStateRef.current.controller = null;
      }

      fetchStateRef.current.inFlight = false;
      setIsInitialLoading(false);

      if (fetchStateRef.current.queued) {
        fetchStateRef.current.queued = false;
        window.setTimeout(() => {
          runFetch();
        }, 0);
      }
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (fetchStateRef.current.inFlight) {
      fetchStateRef.current.queued = true;
      return;
    }

    runFetch();
  }, [runFetch]);

  const scheduleRealtimeRefresh = useCallback(() => {
    window.clearTimeout(realtimeRefreshTimeoutRef.current);
    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      scheduleRefresh();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [scheduleRefresh]);

  const applyOrderPatch = useCallback((nextOrder) => {
    setOrders((currentOrders) => {
      const existingIndex = currentOrders.findIndex((currentOrder) => currentOrder.id === nextOrder.id);

      if (existingIndex < 0) {
        return [nextOrder, ...currentOrders];
      }

      const updatedOrders = currentOrders.slice();
      updatedOrders[existingIndex] = nextOrder;
      return updatedOrders;
    });
    setError("");
    hasLoadedOnceRef.current = true;
    stampLastUpdated();
  }, [stampLastUpdated]);

  useEffect(() => {
    mountedRef.current = true;
    runFetch({ showLoading: true });

    pollingIntervalRef.current = window.setInterval(() => {
      scheduleRefresh();
    }, POLLING_INTERVAL_MS);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setLiveMode("polling");
    } else {
      const channel = supabase
        .channel(`orders-live-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders"
          },
          () => {
            scheduleRealtimeRefresh();
          }
        )
        .subscribe((status) => {
          if (!mountedRef.current) {
            return;
          }

          if (status === "SUBSCRIBED") {
            setLiveMode("realtime");
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLiveMode("polling");
          }
        });

      supabaseChannelRef.current = channel;
    }

    return () => {
      mountedRef.current = false;
      window.clearInterval(pollingIntervalRef.current);
      window.clearTimeout(realtimeRefreshTimeoutRef.current);
      fetchStateRef.current.controller?.abort();

      if (supabaseChannelRef.current) {
        const client = getSupabaseBrowserClient();
        client?.removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }
    };
  }, [runFetch, scheduleRealtimeRefresh, scheduleRefresh]);

  const liveMeta = useMemo(() => ({
    lastUpdatedAt,
    liveMode
  }), [lastUpdatedAt, liveMode]);

  return {
    orders,
    isInitialLoading,
    error,
    lastUpdatedAt: liveMeta.lastUpdatedAt,
    liveMode: liveMeta.liveMode,
    applyOrderPatch
  };
}
