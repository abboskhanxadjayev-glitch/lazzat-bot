import { useCallback, useMemo } from "react";
import { getCouriers } from "../api/client";
import { useLiveList } from "./useLiveList";

const COURIER_REALTIME_TABLES = [{ schema: "public", table: "couriers" }];
const defaultFetchCouriers = ({ signal }) => getCouriers({}, { signal });

export function useLiveCouriers({
  fetchCouriers = defaultFetchCouriers,
  enabled = true,
  channelKey = "couriers-live"
} = {}) {
  const realtimeTables = useMemo(() => COURIER_REALTIME_TABLES, []);
  const fetcher = useCallback(({ signal }) => fetchCouriers({ signal }), [fetchCouriers]);

  const {
    data,
    isInitialLoading,
    error,
    errorMessage,
    lastUpdatedAt,
    liveMode,
    upsertItem,
    removeItem,
    refetch
  } = useLiveList({
    fetcher,
    enabled,
    realtimeTables,
    channelKey
  });

  return {
    couriers: data,
    isInitialLoading,
    error,
    errorMessage,
    lastUpdatedAt,
    liveMode,
    applyCourierPatch: upsertItem,
    removeCourier: removeItem,
    refetch
  };
}
