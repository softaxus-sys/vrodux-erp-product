import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { usePortalSettings, useUpdatePortalSettings } from "@/hooks/library/use-library";
import { portalUrl } from "@/lib/library/portal.api";
import { Pill } from "../../shared/ui";

type Flags = { enabled: boolean; allowRenewals: boolean; allowReservations: boolean; publicCatalogue: boolean };

/** The members' own page: whether it is open, and what members may do there. */
export function PortalCard({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation("library");
  const slug = useAuthStore(s => s.tenant?.slug);
  const { data: settings, isLoading } = usePortalSettings();
  const save = useUpdatePortalSettings();

  const [f, setF] = React.useState<Flags>({ enabled: false, allowRenewals: true, allowReservations: true, publicCatalogue: false });

  React.useEffect(() => {
    if (!settings) return;
    setF({
      enabled: settings.enabled, allowRenewals: settings.allowRenewals,
      allowReservations: settings.allowReservations, publicCatalogue: settings.publicCatalogue,
    });
  }, [settings]);

  if (isLoading || !settings) return null;

  const dirty = (Object.keys(f) as (keyof Flags)[]).some(k => f[k] !== settings[k]);
  const link = slug ? portalUrl(slug) : null;

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success(t("portal.linkCopied")); }
    catch { toast.error(t("portal.linkCopyFailed")); }
  };

  const check = (key: keyof Flags, disabled = false) => (
    <label className={cn("flex items-start gap-2 text-sm", canEdit && !disabled && "cursor-pointer", disabled && "opacity-60")}>
      <input type="checkbox" className="mt-0.5" checked={f[key]} disabled={!canEdit || disabled}
        onChange={e => setF(prev => ({ ...prev, [key]: e.target.checked }))} />
      <span>
        <span className="font-medium">{t(`portal.${key}`)}</span>
        <span className="block text-xs text-muted-foreground">{t(`portal.${key}Hint`)}</span>
      </span>
    </label>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold">{t("portal.heading")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("portal.description")}</p>
          </div>
          <Pill meta={settings.enabled ? { color: "text-success", bg: "bg-success/10" } : { color: "text-muted-foreground", bg: "bg-muted" }}>
            {settings.enabled ? t("portal.on") : t("portal.off")}
          </Pill>
        </div>

        <div className="p-4 space-y-4">
          {check("enabled")}
          <div className="grid sm:grid-cols-3 gap-3">
            {check("allowRenewals", !f.enabled)}
            {check("allowReservations", !f.enabled)}
            {check("publicCatalogue", !f.enabled)}
          </div>

          {link && (
            <div className="rounded-lg border border-border px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("portal.link")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs break-all flex-1 min-w-0">{link}</code>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}><Copy className="h-3.5 w-3.5" />{t("portal.copy")}</Button>
                {settings.enabled && (
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{t("portal.open")}</a>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("portal.linkHint", { count: settings.membersWithAccess })}</p>
            </div>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={!dirty || save.isPending} onClick={() => save.mutate(f)}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
