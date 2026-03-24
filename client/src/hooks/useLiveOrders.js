import { useCallback, useMemo } from "react";
import { getOrders } from "../api/client";
import { useLiveList } from "./useLiveList";

const ORDER_REALTIME_TABLES = [{ schema: "public", table: "orders" }];

export function useLiveOrders({ fetchOrders = getOrders, enabled = true, channelKey = "orders-live" } = {}) {
  const realtimeTables = useMemo(() => ORDER_REALTIME_TABLES, []);
  const fetcher = useCallback(({ signal }) => fetchOrders({ signal }), [fetchOrders]);

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
    orders: data,
    isInitialLoading,
    error,
    errorMessage,
    lastUpdatedAt,
    liveMode,
    applyOrderPatch: upsertItem,
    removeOrder: removeItem,
    refetch
  };
}
