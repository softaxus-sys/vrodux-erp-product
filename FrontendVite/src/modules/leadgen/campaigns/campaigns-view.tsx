import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Mail, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import type { CampaignDto } from "@/lib/leadgen/leadgen.api";
import { useCampaigns, useDeleteCampaign, useMailboxes, useMeta } from "@/hooks/leadgen/use-leadgen";
import { Banner, ConfirmDialog, EmptyState, ErrorBlock, LeadGenFrame, LoadingBlock, NoAccess, StatusPill, useCanAny } from "../shared/ui";
import { CampaignBuilder } from "./campaign-builder";
import { CampaignDrawer } from "./campaign-drawer";

export function CampaignsView() {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  const canView = useCanAny(["leadgen.campaigns.view"]);
  const list = useCampaigns(canView);
  const meta = useMeta(canView);
  const mailboxes = useMailboxes(canView);
  const del = useDeleteCampaign();

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [builder, setBuilder] = React.useState<{ campaign?: CampaignDto } | null>(null);
  const [toDelete, setToDelete] = React.useState<CampaignDto | null>(null);

  if (!canView) return <LeadGenFrame title={t("campaigns.title")}><NoAccess permission="leadgen.campaigns.view" /></LeadGenFrame>;

  const hasMailbox = (mailboxes.data ?? []).some(m => m.status === "connected");
  const rows = list.data ?? [];

  return (
    <LeadGenFrame title={t("campaigns.title")} description={t("campaigns.description")}
      actions={<Can permission="leadgen.campaigns.create"><Button className="gap-2" onClick={() => setBuilder({})}><Plus className="h-4 w-4" />{t("campaigns.new")}</Button></Can>}>

      {meta.data && !meta.data.canSend && meta.data.sendBlockReason && (
        <Banner tone="warn" action={<Can permission="leadgen.settings.view"><Button size="sm" variant="outline" onClick={() => navigate("/lead-generation/settings")}>{t("banner.openSettings")}</Button></Can>}>{meta.data.sendBlockReason}</Banner>
      )}
      {!mailboxes.isLoading && !hasMailbox && (
        <Banner tone="info" action={<Can permission="leadgen.mailboxes.view"><Button size="sm" variant="outline" onClick={() => navigate("/lead-generation/mailboxes")}>{t("campaigns.connectMailbox")}</Button></Can>}>{t("campaigns.needMailbox")}</Banner>
      )}

      {list.isLoading ? <LoadingBlock />
        : list.error ? <ErrorBlock error={list.error as Error} onRetry={() => list.refetch()} />
        : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={Send} title={t("campaigns.emptyTitle")} body={t("campaigns.emptyBody")}
              action={<Can permission="leadgen.campaigns.create"><Button onClick={() => setBuilder({})}>{t("campaigns.new")}</Button></Can>} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map(c => (
              <article key={c.id} onClick={() => setOpenId(c.id)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter") setOpenId(c.id); }}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold truncate">{c.name}</p><p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{c.mailboxAddress ?? "—"}</p></div>
                  <StatusPill status={c.status} />
                </div>
                {c.status === "paused" && c.pauseReason && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 line-clamp-2">{c.pauseReason}</p>}
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <Stat label={t("campaigns.recipients")} value={c.counts.total} />
                  <Stat label={t("campaigns.sent")} value={c.sent} />
                  <Stat label={t("campaigns.replied")} value={c.counts.replied} good={c.counts.replied > 0} />
                  <Stat label={t("campaigns.bounced")} value={c.counts.bounced} bad={c.bounceRatePercent > 3} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">{t("campaigns.stepsCount", { count: c.steps.length })} · {formatDate(c.createdAt, "relative")}</p>
              </article>
            ))}
          </div>
        )}

      <AnimatePresence>
        {openId && <CampaignDrawer id={openId} onClose={() => setOpenId(null)} onEdit={c => setBuilder({ campaign: c })} onDelete={setToDelete} />}
        {builder && <CampaignBuilder campaign={builder.campaign} onClose={() => setBuilder(null)} onSaved={c => setOpenId(c.id)} />}
        {toDelete && <ConfirmDialog title={t("campaigns.deleteTitle", { name: toDelete.name })} body={t("campaigns.deleteBody")} confirmLabel={t("action.delete")} pending={del.isPending}
          onClose={() => setToDelete(null)} onConfirm={() => del.mutate(toDelete.id, { onSuccess: () => { setToDelete(null); setOpenId(null); } })} />}
      </AnimatePresence>
    </LeadGenFrame>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return (
    <div><p className={`text-lg font-bold tabular-nums ${good ? "text-success" : bad ? "text-destructive" : ""}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
  );
}
