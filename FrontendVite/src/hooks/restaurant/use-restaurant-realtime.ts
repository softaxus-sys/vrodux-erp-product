import * as React from "react";
import * as signalR from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { RESTAURANT_HUB_URL } from "@/lib/restaurant/restaurant.api";
import { useAuthStore } from "@/store/auth.store";
import { rKeys } from "./use-restaurant";

/**
 * Connects to the KDS/table-board realtime push (see RestaurantHub on the backend) and invalidates
 * the matching React Query caches on "kitchenChanged"/"tablesChanged". Best-effort only — the existing
 * refetchInterval polling on every affected query already covers the gap if the socket never connects
 * or drops (e.g. no websocket support behind a proxy), so a connection failure is logged, not surfaced.
 */
export function useRestaurantRealtime() {
  const qc = useQueryClient();
  const token = useAuthStore(s => s.token);

  React.useEffect(() => {
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(RESTAURANT_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on("kitchenChanged", () => {
      qc.invalidateQueries({ queryKey: rKeys.kitchen() });
      qc.invalidateQueries({ queryKey: rKeys.kitchenSummary() });
      qc.invalidateQueries({ queryKey: rKeys.orders() });
    });
    connection.on("tablesChanged", () => {
      qc.invalidateQueries({ queryKey: rKeys.tables() });
      qc.invalidateQueries({ queryKey: rKeys.tablesSummary() });
      qc.invalidateQueries({ queryKey: rKeys.floorLayout() });
    });

    connection.start().catch(err => console.warn("RestaurantHub: connection failed, falling back to polling.", err));

    return () => { connection.stop(); };
  }, [token, qc]);
}
