import * as React from "react";
import * as signalR from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { SUPPORT_HUB_URL } from "@/lib/support/support.api";
import { useAuthStore } from "@/store/auth.store";

const QK = "support";

/**
 * Both hooks below share the same connect/reconnect shape as useRestaurantRealtime, with one
 * addition Restaurant's hub doesn't need: SUPPORT_HUB_URL is group-targeted (see SupportHub /
 * ISupportRealtimeNotifier on the backend — the platform-wide blast radius here rules out
 * Restaurant's broadcast-to-everyone approach), so the client must explicitly (re)join its room
 * — including after `onreconnected`, since a dropped connection loses server-side group
 * membership even though the SAME connection object survives automatic reconnect. Best-effort
 * only: React Query's own staleTime/refetch-on-focus already covers a socket that never connects
 * or silently drops (no websocket support behind some proxy, etc.) — a connection failure here is
 * logged, not surfaced to the user.
 */

/** Live-updates one open ticket's thread (new messages, status/assignment/priority changes). */
export function useSupportTicketRealtime(ticketId: string | null, enabled: boolean) {
  const qc = useQueryClient();
  const token = useAuthStore(s => s.token);

  React.useEffect(() => {
    if (!enabled || !ticketId || !token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(SUPPORT_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const join = () => connection.invoke("JoinTicket", ticketId).catch(() => { /* logged by the framework */ });

    connection.on("ticketUpdated", () => {
      qc.invalidateQueries({ queryKey: [QK, "ticket", ticketId] });
    });
    connection.onreconnected(() => { void join(); });

    connection.start()
      .then(join)
      .catch(err => console.warn("SupportHub: connection failed, falling back to polling.", err));

    return () => { connection.stop(); };
  }, [enabled, ticketId, token, qc]);
}

/** Live-updates the agent queue (new tickets, and any ticket's status/assignment/priority changing). */
export function useSupportQueueRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const token = useAuthStore(s => s.token);

  React.useEffect(() => {
    if (!enabled || !token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(SUPPORT_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const join = () => connection.invoke("JoinQueue").catch(() => { /* logged by the framework */ });

    connection.on("queueChanged", () => {
      qc.invalidateQueries({ queryKey: [QK, "queue"] });
      qc.invalidateQueries({ queryKey: [QK, "queue-summary"] });
    });
    connection.onreconnected(() => { void join(); });

    connection.start()
      .then(join)
      .catch(err => console.warn("SupportHub: connection failed, falling back to polling.", err));

    return () => { connection.stop(); };
  }, [enabled, token, qc]);
}
