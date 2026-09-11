import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { crmNotificationsApi } from "@/lib/crm/notifications.api";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAuthStore } from "@/store/auth.store";
import type { Notification } from "@/types";

/** How often the bell checks for new alerts. There is no push channel for CRM, so this is the "live" part. */
const POLL_MS = 30_000;

export const crmNotificationKeys = { mine: ["crm", "notifications", "mine"] as const };

/**
 * Keeps the top-bar notification store in step with the server and pops a toast for each alert that
 * arrived since the last check. Mount once (the notification panel does).
 *
 * The first load never toasts — otherwise every page refresh would replay the backlog as "new".
 */
export function useCrmNotificationsSync() {
  const navigate = useNavigate();
  const setNotifications = useNotificationsStore((s) => s.setNotifications);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCrm = useAuthStore((s) => s.hasModuleAccess("crm"));
  const seen = React.useRef<Set<string> | null>(null);

  const query = useQuery({
    queryKey: crmNotificationKeys.mine,
    queryFn: () => crmNotificationsApi.getMine(50),
    enabled: isAuthenticated && hasCrm,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: POLL_MS / 2,
    retry: false,
  });

  React.useEffect(() => {
    const data = query.data;
    if (!data) return;

    const mapped: Notification[] = data.items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      timestamp: n.createdAt,
      actionUrl: n.link ?? undefined,
      module: "crm",
    }));
    setNotifications(mapped, data.unreadCount);

    if (seen.current === null) {
      seen.current = new Set(data.items.map((n) => n.id));
      return;
    }
    for (const n of data.items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.read) continue;
      toast(n.title, {
        description: n.message,
        duration: 10_000,
        action: n.link ? { label: "Open", onClick: () => navigate(n.link!) } : undefined,
      });
    }
  }, [query.data, setNotifications, navigate]);

  return query;
}
