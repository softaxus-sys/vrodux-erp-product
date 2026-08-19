import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useNotificationProviderConfig, useUpsertNotificationProviderConfig } from "@/hooks/restaurant/use-notification-config";
import type { NotificationChannel } from "@/lib/restaurant/notifications.api";

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
];

export function NotificationConfigView() {
  const { t } = useTranslation("settings");
  const [channel, setChannel] = React.useState<NotificationChannel>("sms");
  const canEdit = useCan("restaurant.notifications.edit");
  const { data: config, isLoading } = useNotificationProviderConfig(channel);
  const upsert = useUpsertNotificationProviderConfig();

  const [accountSid, setAccountSid] = React.useState("");
  const [authToken, setAuthToken] = React.useState("");
  const [fromNumber, setFromNumber] = React.useState("");
  const [isEnabled, setIsEnabled] = React.useState(true);

  React.useEffect(() => {
    if (config) {
      setFromNumber(config.fromNumber ?? "");
      setIsEnabled(config.isEnabled);
      setAccountSid(""); setAuthToken("");
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        channel, provider: "twilio",
        accountSid: accountSid.trim() || null,
        authToken: authToken.trim() || null,
        fromNumber: fromNumber.trim() || null,
        isEnabled,
      });
    } catch { /* toast in hook */ }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> {t("notifications.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("notifications.description")}
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {CHANNELS.map(c => (
          <button key={c.id} onClick={() => setChannel(c.id)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium",
              channel === c.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3 max-w-md">
          <p className="text-sm font-semibold text-foreground">{t("notifications.twilio")}</p>
          <div>
            <label className="text-xs text-muted-foreground">{config?.hasAccountSid ? t("notifications.accountSidKeep") : t("notifications.accountSid")}</label>
            <Input type="password" value={accountSid} onChange={e => setAccountSid(e.target.value)}
              placeholder={config?.hasAccountSid ? t("notifications.unchanged") : "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} disabled={!canEdit} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{config?.hasAuthToken ? t("notifications.authTokenKeep") : t("notifications.authToken")}</label>
            <Input type="password" value={authToken} onChange={e => setAuthToken(e.target.value)}
              placeholder={config?.hasAuthToken ? t("notifications.unchanged") : ""} disabled={!canEdit} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("notifications.fromNumber")}</label>
            <Input value={fromNumber} onChange={e => setFromNumber(e.target.value)}
              placeholder={channel === "whatsapp" ? t("notifications.fromPhWhatsapp") : t("notifications.fromPhSms")} disabled={!canEdit} className="h-9 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} disabled={!canEdit} /> {t("notifications.enabled")}
          </label>

          {canEdit && (
            <Button className="w-full" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("notifications.save")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
