import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCourierProfile } from "../api/client";
import { getSupabaseBrowserClient, hasSupabaseRealtimeConfig } from "../utils/supabaseBrowser";

const POLLING_INTERVAL_MS = 5000;
const REALTIME_REFRESH_DEBOUNCE_MS = 400;
const COURIER_REALTIME_TABLES = [{ schema: "public", table: "couriers" }];

export function useLiveCourierProfile({ telegramUserId = null, enabled = true }) {
  const [courier, setCourier] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
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
  const channelCleanupRef = useRef([]);
  const hasLoadedOnceRef = useRef(false);

  const cleanupRealtimeChannels = useCallback(() => {
    if (!channelCleanupRef.current.length) {
      return;
    }

    const client = getSupabaseBrowserClient();

    channelCleanupRef.current.forEach((channel) => {
      client?.removeChannel(channel);
    });

    channelCleanupRef.current = [];
  }, []);

  const runFetch = useCallback(async ({ showLoading = false } = {}) => {
    if (!mountedRef.current || !enabled) {
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
      const nextCourier = await getCourierProfile(telegramUserId, { signal: controller.signal });

      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      setCourier(nextCourier);
      setError(null);
      setLastUpdatedAt(new Date());
      hasLoadedOnceRef.current = true;
    } catch (requestError) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      console.error("[courier-profile] fetch error", requestError);

      if (!hasLoadedOnceRef.current) {
        setError(requestError);
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
  }, [enabled, telegramUserId]);

  const scheduleRefresh = useCallback(() => {
    if (!mountedRef.current || !enabled) {
      return;
    }

    if (fetchStateRef.current.inFlight) {
      fetchStateRef.current.queued = true;
      return;
    }

    runFetch();
  }, [enabled, runFetch]);

  const scheduleRealtimeRefresh = useCallback(() => {
    window.clearTimeout(realtimeRefreshTimeoutRef.current);
    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      scheduleRefresh();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [scheduleRefresh]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setCourier(null);
      setError(null);
      setIsInitialLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    setIsInitialLoading(true);
    runFetch({ showLoading: true });

    pollingIntervalRef.current = window.setInterval(() => {
      scheduleRefresh();
    }, POLLING_INTERVAL_MS);

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setLiveMode("polling");
    } else {
      cleanupRealtimeChannels();

      const channelSuffix = telegramUserId || "telegram";
      const channels = COURIER_REALTIME_TABLES.map((tableConfig, index) => supabase
        .channel(`courier-profile-${channelSuffix}-${index}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: tableConfig.schema,
            table: tableConfig.table
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
        }));

      channelCleanupRef.current = channels;
    }

    return () => {
      mountedRef.current = false;
      window.clearInterval(pollingIntervalRef.current);
      window.clearTimeout(realtimeRefreshTimeoutRef.current);
      fetchStateRef.current.controller?.abort();
      cleanupRealtimeChannels();
    };
  }, [cleanupRealtimeChannels, enabled, runFetch, scheduleRealtimeRefresh, scheduleRefresh, telegramUserId]);

  const setCourierProfile = useCallback((nextCourier) => {
    setCourier(nextCourier);
    setError(null);
    setLastUpdatedAt(new Date());
    hasLoadedOnceRef.current = true;
  }, []);

  return useMemo(() => ({
    courier,
    isInitialLoading,
    error,
    errorMessage: error?.message || "",
    lastUpdatedAt,
    liveMode,
    setCourierProfile,
    refetch: scheduleRefresh
  }), [courier, error, isInitialLoading, lastUpdatedAt, liveMode, scheduleRefresh, setCourierProfile]);
}
