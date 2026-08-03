import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  notificationConfigApi, type NotificationChannel, type UpsertNotificationProviderConfigRequest,
} from "@/lib/restaurant/notifications.api";

const QK = "restaurant-notification-config";

export const useNotificationProviderConfig = (channel: NotificationChannel) =>
  useQuery({ queryKey: [QK, channel], queryFn: () => notificationConfigApi.getConfig(channel) });

export function useUpsertNotificationProviderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: UpsertNotificationProviderConfigRequest) => notificationConfigApi.upsertConfig(req),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QK, data.channel] });
      toast.success("Notification settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
