import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, RefreshCw, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useAccounts } from "@/hooks/finance/use-finance";
import {
  useUpdateIntegrationSetting, useUpdateApproval, useSaveAccountMappings, useSyncIntegrations,
} from "@/hooks/finance/use-finance-integrations";
import type { IntegrationDto, IntegrationMode } from "@/lib/finance/integrations.api";
import { HealthBadge, LABEL_CLASS, SELECT_CLASS, useIntegrationText } from "./shared";
import { AutoPostingConfirm } from "./posting-check";

const MODES: IntegrationMode[] = ["off", "review", "auto"];

/**
 * One integration: how it behaves and which accounts it posts to. Rendered by the parent inside
 * AnimatePresence — an exit animation declared in here would never run.
 */
export function IntegrationDrawer({ integration, onClose, onOpenQueue }: {
  integration: IntegrationDto;
  onClose: () => void;
  onOpenQueue: (key: string) => void;
}) {
  const { t } = useTranslation("finance");
  const text = useIntegrationText();
  const canEdit = useCan("finance.integrations.edit");
  const canPost = useCan("finance.integrations.approve");
  const isQueue = integration.kind === "queue";

  const { data: accounts = [] } = useAccounts({ isActive: true });
  const updateSetting = useUpdateIntegrationSetting();
  const updateApproval = useUpdateApproval();
  const saveMappings  = useSaveAccountMappings();
  const sync          = useSyncIntegrations();

  const [mode, setMode]           = React.useState<IntegrationMode>(integration.mode ?? "off");
  const [startDate, setStartDate] = React.useState(integration.startDate ?? "");
  const [limit, setLimit] = React.useState(integration.approvalLimit != null ? String(integration.approvalLimit) : "");
  const [second, setSecond] = React.useState(integration.requireSeparateApprover);
  // role → account id; "" means "use the default account".
  const [mapping, setMapping] = React.useState<Record<string, string>>({});

  // Re-seeded when the server copy changes, so a save elsewhere is not shown stale here.
  React.useEffect(() => {
    setMode(integration.mode ?? "off");
    setStartDate(integration.startDate ?? "");
    setLimit(integration.approvalLimit != null ? String(integration.approvalLimit) : "");
    setSecond(integration.requireSeparateApprover);
    setMapping(Object.fromEntries(integration.roles.map(r => [r.role, r.isMapped ? (r.accountId ?? "") : ""])));
  }, [integration]);

  const [confirmAuto, setConfirmAuto] = React.useState(false);

  // Automatic posting cannot be chosen for a type that always needs a person, or while a second
  // approver is required — the server refuses both, so the choice is not offered.
  const autoBlocked = !integration.autoAllowed || integration.requireSeparateApprover;
  const modeBlocked = (m: IntegrationMode) => !canEdit || (m === "auto" && (!canPost || autoBlocked));
  const limitNumber = limit.trim() === "" ? null : Number(limit);
  const limitInvalid = limitNumber !== null && (!Number.isFinite(limitNumber) || limitNumber <= 0);
  const approvalDirty = limitNumber !== integration.approvalLimit || second !== integration.requireSeparateApprover;

  const settingDirty = mode !== (integration.mode ?? "off") || startDate !== (integration.startDate ?? "");

  // Automatic posting — switching it on, or moving its start date — goes through a warning first.
  const saveBehaviour = () => {
    if (mode === "auto") setConfirmAuto(true);
    else updateSetting.mutate({ key: integration.key, mode, startDate: startDate || null });
  };
  const mappingDirty = integration.roles.some(r => (mapping[r.role] ?? "") !== (r.isMapped ? (r.accountId ?? "") : ""));

  const sortedAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
    [accounts],
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed end-0 top-0 h-full w-full max-w-xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{text.module(integration.module)}</p>
              <h2 className="text-base font-bold text-foreground truncate">{text.name(integration)}</h2>
              <div className="mt-2"><HealthBadge health={integration.health} /></div>
            </div>
            <button onClick={onClose} aria-label={t("integrations.close")}
              className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <section className="space-y-2">
              <p className={LABEL_CLASS}>{t("integrations.drawer.trigger")}</p>
              <p className="text-sm text-foreground">{text.trigger(integration)}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{text.notes(integration)}</p>
            </section>

            {integration.issues.length > 0 && (
              <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                {integration.issues.map(issue => (
                  <p key={issue} className="flex gap-2 text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{issue}
                  </p>
                ))}
              </section>
            )}

            {isQueue && (
              <section className="rounded-xl border border-border p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("integrations.drawer.behaviour")}</p>
                <div className="space-y-2">
                  {MODES.map(m => (
                    <label key={m} className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      mode === m ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                      modeBlocked(m) && "cursor-not-allowed opacity-70",
                    )}>
                      <input type="radio" name="mode" className="mt-1 accent-primary"
                        disabled={modeBlocked(m)}
                        checked={mode === m} onChange={() => setMode(m)} />
                      <span>
                        <span className="block text-sm font-medium text-foreground">{t(`integrations.mode.${m}.label`)}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{t(`integrations.mode.${m}.hint`)}</span>
                        {m === "auto" && (
                          <span className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                            {!integration.autoAllowed ? t("integrations.hub.manualOnlyNote")
                              : integration.requireSeparateApprover ? t("integrations.hub.separateBlocksAuto")
                              : canPost ? t("integrations.auto.radioWarning") : t("integrations.auto.needsApprove")}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL_CLASS} htmlFor="integration-start-date">{t("integrations.drawer.startDate")}</label>
                  <Input id="integration-start-date" type="date" value={startDate} disabled={!canEdit}
                    onChange={e => setStartDate(e.target.value)} className="h-9 text-sm max-w-[200px]" />
                  <p className="text-xs text-muted-foreground">{t("integrations.drawer.startDateHint")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <Button size="sm" disabled={!settingDirty || updateSetting.isPending}
                      onClick={saveBehaviour}>
                      {t("integrations.drawer.saveBehaviour")}
                    </Button>
                  )}
                  {canPost && integration.mode !== "off" && integration.mode !== null && (
                    <Button size="sm" variant="outline" disabled={sync.isPending || settingDirty}
                      onClick={() => sync.mutate(integration.key)}>
                      <RefreshCw className={cn("w-3.5 h-3.5 me-1.5", sync.isPending && "animate-spin")} />
                      {t("integrations.collectNow")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onOpenQueue(integration.key)}>
                    <ListChecks className="w-3.5 h-3.5 me-1.5" />{t("integrations.drawer.openQueue")}
                  </Button>
                </div>

                {integration.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("integrations.drawer.lastCollected", { when: formatDate(integration.lastSyncAt) })}
                  </p>
                )}
              </section>
            )}

            {isQueue && (
              <section className="rounded-xl border border-border p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("integrations.hub.approvalTitle")}</p>

                <div className="space-y-1.5">
                  <label className={LABEL_CLASS} htmlFor="integration-approval-limit">{t("integrations.hub.limitLabel")}</label>
                  <Input id="integration-approval-limit" type="number" min="0" step="0.01" inputMode="decimal"
                    value={limit} disabled={!canPost} onChange={e => setLimit(e.target.value)}
                    aria-invalid={limitInvalid} className="h-9 text-sm max-w-[200px]" />
                  <p className="text-xs text-muted-foreground">{t("integrations.hub.limitHint")}</p>
                </div>

                <label className={cn("flex items-start gap-3", (!canPost || mode === "auto") && "opacity-70")}>
                  <input type="checkbox" className="mt-1 accent-primary" checked={second}
                    disabled={!canPost || mode === "auto"} onChange={e => setSecond(e.target.checked)} />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("integrations.hub.separateLabel")}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{t("integrations.hub.separateHint")}</span>
                  </span>
                </label>

                {canPost && (
                  <Button size="sm" disabled={!approvalDirty || limitInvalid || updateApproval.isPending}
                    onClick={() => updateApproval.mutate({ key: integration.key, approvalLimit: limitNumber, requireSeparateApprover: second })}>
                    {t("integrations.hub.saveApproval")}
                  </Button>
                )}
              </section>
            )}

            {integration.roles.length > 0 && (
              <section className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("integrations.drawer.accounts")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isQueue ? t("integrations.drawer.accountsHint") : t("integrations.drawer.accountsFixed")}
                  </p>
                </div>

                <div className="space-y-3">
                  {integration.roles.map(r => (
                    <div key={r.role} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_72px_minmax(0,1.4fr)] items-center gap-x-3 gap-y-1.5">
                      <p className="text-sm text-foreground">{text.role(r.role, r.label)}</p>
                      <span className={cn("text-xs font-medium rounded px-1.5 py-0.5 justify-self-start sm:justify-self-auto text-center",
                        r.side === "debit" ? "bg-sky-500/10 text-sky-700 dark:text-sky-400" : "bg-violet-500/10 text-violet-700 dark:text-violet-400")}>
                        {t(`integrations.side.${r.side}`)}
                      </span>
                      {isQueue && canEdit ? (
                        <select aria-label={text.role(r.role, r.label)}
                          className={cn(SELECT_CLASS, "w-full col-span-2 sm:col-span-1 min-w-0")}
                          value={mapping[r.role] ?? ""}
                          onChange={e => setMapping(prev => ({ ...prev, [r.role]: e.target.value }))}>
                          <option value="">{t("integrations.drawer.defaultAccount", { number: r.defaultAccountNumber })}</option>
                          {sortedAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.accountNumber} — {a.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className={cn("text-sm col-span-2 sm:col-span-1 truncate",
                          r.isResolved ? "text-muted-foreground" : "text-red-600 dark:text-red-400")}>
                          {r.isResolved ? `${r.accountNumber} — ${r.accountName}` : t("integrations.drawer.accountMissing", { number: r.defaultAccountNumber })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {isQueue && canEdit && (
                  <Button size="sm" disabled={!mappingDirty || saveMappings.isPending}
                    onClick={() => saveMappings.mutate({
                      key: integration.key,
                      mappings: integration.roles.map(r => ({ role: r.role, accountId: mapping[r.role] || null })),
                    })}>
                    {t("integrations.drawer.saveAccounts")}
                  </Button>
                )}
              </section>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {confirmAuto && (
          <AutoPostingConfirm integration={integration} startDate={startDate || null}
            busy={updateSetting.isPending}
            onCancel={() => setConfirmAuto(false)}
            onConfirm={() => updateSetting.mutate(
              { key: integration.key, mode: "auto", startDate: startDate || null, acknowledgeAuto: true },
              { onSuccess: () => setConfirmAuto(false) },
            )} />
        )}
      </AnimatePresence>
    </>
  );
}
