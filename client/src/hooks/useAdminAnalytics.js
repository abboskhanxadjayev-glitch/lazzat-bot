import { useCallback, useEffect, useRef, useState } from "react";
import { getAdminAnalytics, getAdminCourierPerformance } from "../api/client";

const POLL_INTERVAL_MS = 5000;
const EMPTY_ANALYTICS = {
  todayOrderCount: 0,
  todayRevenue: 0,
  activeOrderCount: 0,
  deliveredOrderCount: 0,
  onlineCourierCount: 0,
  offlineCourierCount: 0,
  todayDeliveryFeeTotal: 0,
  averageOrderValueToday: 0,
  topCourierTodayByDeliveredOrders: null,
  topCourierTodayByRevenue: null,
  generatedAt: null
};

export function useAdminAnalytics(enabled = true) {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [courierPerformance, setCourierPerformance] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const mountedRef = useRef(false);
  const fetchStateRef = useRef({
    inFlight: false,
    controller: null,
    queued: false
  });

  const runFetch = useCallback(async () => {
    if (!mountedRef.current || !enabled) {
      return;
    }

    if (fetchStateRef.current.inFlight) {
      fetchStateRef.current.queued = true;
      return;
    }

    const controller = new AbortController();
    fetchStateRef.current.inFlight = true;
    fetchStateRef.current.controller = controller;
    fetchStateRef.current.queued = false;

    try {
      const [nextAnalytics, nextPerformance] = await Promise.all([
        getAdminAnalytics({ signal: controller.signal }),
        getAdminCourierPerformance({ signal: controller.signal })
      ]);

      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      setAnalytics(nextAnalytics || EMPTY_ANALYTICS);
      setCourierPerformance(Array.isArray(nextPerformance) ? nextPerformance : []);
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      console.error("[admin-analytics] fetch error", requestError);
      setError(requestError);
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
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setAnalytics(EMPTY_ANALYTICS);
      setCourierPerformance([]);
      setError(null);
      setIsInitialLoading(false);
      setLastUpdatedAt(null);
      return () => {
        mountedRef.current = false;
      };
    }

    setIsInitialLoading(true);
    runFetch();

    const intervalId = window.setInterval(() => {
      runFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      fetchStateRef.current.controller?.abort();
    };
  }, [enabled, runFetch]);

  return {
    analytics,
    courierPerformance,
    isInitialLoading,
    error,
    errorMessage: error?.message || "",
    lastUpdatedAt,
    liveMode: "polling",
    refetch: runFetch
  };
}