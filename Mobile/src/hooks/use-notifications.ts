import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/notifications.api";

const QK = "notifications" as const;

/** No module/permission gate -- the endpoint itself is `[Authorize]`-only, scoped to the caller's
 *  own rows (see types/notifications.ts). `refetchInterval` keeps the header bell's unread badge
 *  reasonably fresh without needing a live push to arrive first. */
export function useMyNotifications(refetchInterval: number | false = 60_000) {
  return useQuery({
    queryKey: [QK, "mine"],
    queryFn: () => notificationsApi.getMine(50),
    refetchInterval,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "mine"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "mine"] }),
  });
}
