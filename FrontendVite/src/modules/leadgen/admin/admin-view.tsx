import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type PlatformSettingsDto } from "@/lib/leadgen/leadgen.api";
import { useAdminGrant, useAdminOverview, useAdminSettings, useAdminUpdateSettings } from "@/hooks/leadgen/use-leadgen";
import { ErrorBlock, Field, LoadingBlock, Modal, StatTile, TEXTAREA, TH, formatDateTime } from "../shared/ui";

type NumKey = { [K in keyof PlatformSettingsDto]: PlatformSettingsDto[K] extends number ? K : never }[keyof PlatformSettingsDto];
type BoolKey = { [K in keyof PlatformSettingsDto]: PlatformSettingsDto[K] extends boolean ? K : never }[keyof PlatformSettingsDto];

const NUMBERS: NumKey[] = [
  "revealCost", "verifiedEmailBonus", "trialGrantCredits", "dailySearchLimit", "dailyDiscoveryLimit", "maxResultsPerSearch",
  "maxRevealsPerRequest", "poolFreshDays", "bounceRefundDays", "maxMailboxesPerWorkspace", "maxDailySendsPerMailbox",
  "maxDailySendsPerWorkspace", "bounceRatePauseBp", "complaintRatePauseBp",
];
const BOOLS: BoolKey[] = ["enabled", "requireSenderIdentity", "blockSendingOnTrial"];

/** Platform-owner console for Lead Generation. Reached from the super-admin header; the API enforces SuperAdminOnly. */
export function LeadGenAdminView() {
  const { t, i18n } = useTranslation("leadgen");
  const navigate = useNavigate();
  const overview = useAdminOverview();
  const settings = useAdminSettings();
  const save = useAdminUpdateSettings();
  const [s, setS] = React.useState<PlatformSettingsDto | null>(null);
  const [grant, setGrant] = React.useState<{ tenantId: string; name: string } | null>(null);

  React.useEffect(() => { if (settings.data && !s) setS(settings.data); }, [settings.data]);  // eslint-disable-line react-hooks/exhaustive-deps
  const o = overview.data;
  const fmt = (n: number) => n.toLocaleString(i18n.language);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/super-admin")}><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t("admin.back")}</Button>
        <div><h1 className="text-xl font-bold">{t("admin.title")}</h1><p className="text-sm text-muted-foreground">{t("admin.description")}</p></div>
      </div>

      {overview.isLoading ? <LoadingBlock /> : overview.error ? <ErrorBlock error={overview.error as Error} onRetry={() => overview.refetch()} /> : o && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label={t("admin.workspaces")} value={fmt(o.workspaces)} />
            <StatTile label={t("admin.creditsSold")} value={fmt(o.creditsSold)} />
            <StatTile label={t("admin.creditsSpent")} value={fmt(o.creditsSpent)} />
            <StatTile label={t("admin.outstanding")} value={fmt(o.creditsOutstanding)} hint={t("admin.outstandingHint")} />
            <StatTile label={t("admin.providerCalls")} value={fmt(o.providersRequests30d)} hint={t("admin.last30")} />
            <StatTile label={t("admin.sent")} value={fmt(o.sent30d)} hint={t("admin.last30")} />
            <StatTile label={t("admin.bounced")} value={fmt(o.bounced30d)} tone={o.sent30d > 0 && o.bounced30d / o.sent30d > 0.03 ? "bad" : undefined} />
            <StatTile label={t("admin.pausedMailboxes")} value={fmt(o.pausedMailboxes)} tone={o.pausedMailboxes > 0 ? "warn" : undefined} />
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.pool", { size: fmt(o.poolSize), enriched: fmt(o.poolEnriched) })}</p>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border"><h2 className="text-sm font-bold">{t("admin.topTitle")}</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>
                  <th className={TH}>{t("admin.col.workspace")}</th><th className={cn(TH, "text-end")}>{t("admin.col.balance")}</th><th className={cn(TH, "text-end")}>{t("admin.col.spent")}</th>
                  <th className={cn(TH, "text-end")}>{t("admin.col.prospects")}</th><th className={cn(TH, "text-end")}>{t("admin.col.sent")}</th><th className={TH}>{t("admin.col.last")}</th><th className={TH} />
                </tr></thead>
                <tbody>
                  {o.top.map(w => (
                    <tr key={w.tenantId} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{w.tenantName ?? w.tenantId}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{fmt(w.balance)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{fmt(w.lifetimeSpent)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{fmt(w.prospects)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{fmt(w.sent30d)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(w.lastActivityAt, i18n.language)}</td>
                      <td className="px-4 py-2.5 text-end"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setGrant({ tenantId: w.tenantId, name: w.tenantName ?? w.tenantId })}><Gift className="h-3.5 w-3.5" />{t("admin.grant")}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{t("admin.packsMovedTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("admin.packsMovedBody")}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/super-admin/credit-pricing")}><Coins className="h-4 w-4" />{t("admin.openCreditPricing")}</Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold">{t("admin.settingsTitle")}</h2>
        {!s ? <LoadingBlock /> : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BOOLS.map(k => (
                <label key={k} className="flex items-start gap-2 text-sm rounded-lg border border-border p-3 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={s[k]} onChange={e => setS({ ...s, [k]: e.target.checked })} />
                  <span><span className="font-medium">{t(`admin.setting.${k}`)}</span><span className="block text-xs text-muted-foreground">{t(`admin.setting.${k}Hint`)}</span></span>
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {NUMBERS.map(k => (
                <Field key={k} label={t(`admin.setting.${k}`)} hint={t(`admin.setting.${k}Hint`)}>
                  <Input type="number" min={0} value={s[k]} onChange={e => setS({ ...s, [k]: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} />
                </Field>
              ))}
            </div>
            <Field label={t("admin.setting.allowedCountries")} hint={t("admin.setting.allowedCountriesHint")}>
              <Input value={s.allowedCountries.join(", ")} onChange={e => setS({ ...s, allowedCountries: e.target.value.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean) })} />
            </Field>
            <div className="flex justify-end"><Button className="gap-2" disabled={save.isPending} onClick={() => save.mutate(s)}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}</Button></div>
          </>
        )}
      </section>

      <AnimatePresence>
        {grant && <GrantModal tenantId={grant.tenantId} name={grant.name} onClose={() => setGrant(null)} />}
      </AnimatePresence>
    </div>
  );
}

function GrantModal({ tenantId, name, onClose }: { tenantId: string; name: string; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const grant = useAdminGrant();
  const [amount, setAmount] = React.useState(50);
  const [reason, setReason] = React.useState("");
  return (
    <Modal onClose={onClose} size="sm" title={t("admin.grantTitle", { name })}
      footer={<><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={amount === 0 || reason.trim().length < 3 || grant.isPending} onClick={() => grant.mutate({ tenantId, amount, reason: reason.trim() }, { onSuccess: onClose })}>{t("admin.grant")}</Button></>}>
      <Field label={t("admin.grantAmount")} hint={t("admin.grantAmountHint")}><Input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value || "0", 10) || 0)} /></Field>
      <Field label={t("admin.grantReason")}><textarea className={TEXTAREA} maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    </Modal>
  );
}
