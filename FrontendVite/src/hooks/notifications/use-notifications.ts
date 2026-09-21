import * as React from "react";
import * as signalR from "@microsoft/signalr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  NOTIFICATIONS_HUB_URL, notificationsApi,
  type NotificationDto, type NotificationFeedDto,
} from "@/lib/notifications/notifications.api";
import { playNotificationChime } from "@/lib/notifications/notification-sound";
import { readPrefs, showDesktopNotification } from "@/lib/notifications/notification-prefs";
import { useAuthStore } from "@/store/auth.store";

export const notificationKeys = {
  feed:    ["notifications", "feed"] as const,
  summary: ["notifications", "summary"] as const,
};

/**
 * Polling is the SAFETY NET, not the mechanism. SignalR delivers in real time; this only covers a
 * socket that never connected or silently dropped — behind a proxy that blocks websockets, say. It
 * is deliberately slow, because with push working a fast poll is pure waste.
 */
const POLL_MS = 120_000;

/**
 * The feed. Mount once (the notification panel does) — a second mount would open a second socket
 * and toast everything twice.
 */
export function useNotificationFeed() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery({
    queryKey: notificationKeys.feed,
    queryFn:  () => notificationsApi.getMine({ take: 50 }),
    enabled:  isAuthenticated,
    refetchInterval: POLL_MS,
    // Deliberately NOT refetching in the background. A hidden tab has a socket that will push
    // whatever arrives, and React Query refetches on focus anyway — so polling it as well bought
    // nothing and kept requests in flight against tabs nobody was looking at, which is where most
    // of the abandoned-request noise came from.
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Opens the realtime channel and reacts to what arrives: updates the cache, toasts, chimes, and
 * raises a desktop notification when the tab is in the background.
 *
 * @param onIncoming Called for each genuinely new alert, so the caller owns how the toast looks.
 */
export function useNotificationStream(onIncoming: (n: NotificationDto) => void) {
  const qc = useQueryClient();
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();

  // Kept in refs so the effect does not re-run — and re-open the socket — on every render of the
  // component that owns the toast.
  const handler = React.useRef(onIncoming);
  handler.current = onIncoming;

  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  React.useEffect(() => {
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(NOTIFICATIONS_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // The connection joins its own group server-side from the JWT, so unlike the Support hub there
    // is nothing to (re)join here — including after a reconnect.
    connection.on("notify", (incoming: NotificationDto[]) => {
      const batch = Array.isArray(incoming) ? incoming : [incoming];
      if (batch.length === 0) return;

      const prefs = readPrefs();

      qc.setQueryData<NotificationFeedDto>(notificationKeys.feed, prev => {
        const existing = prev?.items ?? [];
        const seen = new Set(existing.map(n => n.id));
        // A reconnect can replay, and the poll may already have fetched the same row.
        const fresh = batch.filter(n => !seen.has(n.id));
        if (fresh.length === 0) return prev;
        return {
          items: [...fresh, ...existing].slice(0, 50),
          unreadCount: (prev?.unreadCount ?? 0) + fresh.length,
        };
      });
      qc.invalidateQueries({ queryKey: notificationKeys.summary });

      for (const n of batch) {
        // Muting is per device and silences the INTERRUPTION only — the alert is still stored and
        // still listed in the panel. Hiding it entirely would lose information the user may need.
        if (prefs.mutedModules.includes(n.module)) continue;

        handler.current(n);
        if (prefs.sound) playNotificationChime();
        if (prefs.desktop) {
          showDesktopNotification({
            title: n.title,
            body:  n.message,
            tag:   n.id,
            onClick: () => { if (n.link) navigateRef.current(n.link); },
          });
        }
      }
    });

    // Another tab marked things read — keep the badge honest everywhere.
    connection.on("readState", (unreadCount: number) => {
      qc.setQueryData<NotificationFeedDto>(notificationKeys.feed, prev =>
        prev ? { ...prev, unreadCount } : prev);
      qc.invalidateQueries({ queryKey: notificationKeys.feed });
    });

    connection.onreconnected(() => {
      // Anything raised while the socket was down was never pushed, so re-sync rather than assume.
      qc.invalidateQueries({ queryKey: notificationKeys.feed });
    });

    connection.start().catch(err =>
      // Not surfaced to the user: the poll above still delivers, just not instantly.
      console.warn("NotificationsHub: connection failed, falling back to polling.", err));

    return () => { void connection.stop(); };
  }, [token, qc]);
}

/** Per-module unread tallies for the filter chips. */
export function useNotificationSummary(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.summary,
    queryFn:  notificationsApi.summary,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    // Optimistic: the panel must feel instant, and a failure is corrected by the next poll or push.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: notificationKeys.feed });
      const prev = qc.getQueryData<NotificationFeedDto>(notificationKeys.feed);
      qc.setQueryData<NotificationFeedDto>(notificationKeys.feed, cur => {
        if (!cur) return cur;
        const wasUnread = cur.items.some(n => n.id === id && !n.read);
        return {
          items: cur.items.map(n => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, cur.unreadCount - (wasUnread ? 1 : 0)),
        };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(notificationKeys.feed, ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: notificationKeys.summary }); },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.feed });
      const prev = qc.getQueryData<NotificationFeedDto>(notificationKeys.feed);
      qc.setQueryData<NotificationFeedDto>(notificationKeys.feed, cur =>
        cur ? { items: cur.items.map(n => ({ ...n, read: true })), unreadCount: 0 } : cur);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(notificationKeys.feed, ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: notificationKeys.summary }); },
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.dismiss,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: notificationKeys.feed });
      const prev = qc.getQueryData<NotificationFeedDto>(notificationKeys.feed);
      qc.setQueryData<NotificationFeedDto>(notificationKeys.feed, cur => {
        if (!cur) return cur;
        const wasUnread = cur.items.some(n => n.id === id && !n.read);
        return {
          items: cur.items.filter(n => n.id !== id),
          unreadCount: Math.max(0, cur.unreadCount - (wasUnread ? 1 : 0)),
        };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(notificationKeys.feed, ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: notificationKeys.summary }); },
  });
}
