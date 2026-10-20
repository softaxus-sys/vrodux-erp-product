import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Eye, Loader2, Pause, Pencil, Play, Plus, Send, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { formatDate } from "@/lib/utils";
import type { AddRecipientsResult, CampaignDto } from "@/lib/leadgen/leadgen.api";
import {
  useAddRecipients, useCampaign, usePauseCampaign, usePreviewEmail, useProspects, useRecipients, useRemoveRecipients,
  useStartCampaign, useStopCampaign, useTestCampaign,
} from "@/hooks/leadgen/use-leadgen";
import { Banner, ConfirmDialog, ErrorBlock, Field, LoadingBlock, Modal, Pager, SearchBox, SELECT, StatTile, StatusPill, TH, formatDateTime, useDebounced } from "../shared/ui";
import { EmailStatusPill } from "../prospects/prospect-drawer";

export function CampaignDrawer({ id, onClose, onEdit, onDelete }: { id: string; onClose: () => void; onEdit: (c: CampaignDto) => void; onDelete: (c: CampaignDto) => void }) {
  const { t } = useTranslation("leadgen");
  const q = useCampaign(id);
  const start = useStartCampaign();
  const pause = usePauseCampaign();
  const stop = useStopCampaign();
  const removeRecipients = useRemoveRecipients();
  const c = q.data;

  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const recipients = useRecipients(id, { status: status || undefined, page, pageSize: 20 });
  const [preview, setPreview] = React.useState<number | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [confirmStop, setConfirmStop] = React.useState(false);
  React.useEffect(() => { setPage(1); }, [status]);

  const ended = c?.status === "completed" || c?.status === "stopped";
  const openCount = c ? c.counts.pending + c.counts.active : 0;

  return (
    <Modal side size="xl" onClose={onClose} title={c?.name ?? t("campaigns.loading")} subtitle={c ? t("campaigns.sendingFrom", { mailbox: c.mailboxAddress ?? "—" }) : undefined}>
      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock error={q.error as Error} onRetry={() => q.refetch()} />}
      {c && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={c.status} />
            <div className="flex flex-wrap gap-2 ms-auto">
              {(c.status === "draft" || c.status === "paused") && (
                <Can permission="leadgen.campaigns.send">
                  <Button className="gap-2" disabled={start.isPending || c.counts.total === 0} onClick={() => start.mutate(c.id)}>
                    {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{c.status === "paused" ? t("campaigns.resume") : t("campaigns.start")}
                  </Button>
                </Can>
              )}
              {c.status === "active" && (
                <Can anyOf={["leadgen.campaigns.send", "leadgen.campaigns.edit"]}><Button variant="outline" className="gap-2" disabled={pause.isPending} onClick={() => pause.mutate(c.id)}><Pause className="h-4 w-4" />{t("campaigns.pause")}</Button></Can>
              )}
              {!ended && c.status !== "draft" && (
                <Can anyOf={["leadgen.campaigns.send", "leadgen.campaigns.edit"]}><Button variant="outline" className="gap-2" onClick={() => setConfirmStop(true)}><Square className="h-4 w-4" />{t("campaigns.stop")}</Button></Can>
              )}
              <Can permission="leadgen.campaigns.edit"><Button variant="outline" className="gap-2" disabled={c.status === "active" || ended} onClick={() => onEdit(c)}><Pencil className="h-4 w-4" />{t("action.edit")}</Button></Can>
              <Can permission="leadgen.campaigns.delete"><Button variant="ghost" className="text-destructive" onClick={() => onDelete(c)} aria-label={t("action.delete")}><Trash2 className="h-4 w-4" /></Button></Can>
            </div>
          </div>

          {c.status === "paused" && c.pauseReason && <Banner tone="warn">{c.pauseReason}</Banner>}
          {c.status === "draft" && c.counts.total === 0 && <Banner tone="info">{t("campaigns.draftHint")}</Banner>}
          {c.status === "active" && <Banner tone="info">{t("campaigns.activeHint", { start: c.windowStart, end: c.windowEnd, zone: c.timeZoneId })}</Banner>}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label={t("campaigns.recipients")} value={c.counts.total} hint={t("campaigns.waiting", { count: openCount })} />
            <StatTile label={t("campaigns.sent")} value={c.sent} />
            <StatTile label={t("campaigns.replied")} value={c.counts.replied} hint={`${c.replyRatePercent}%`} tone={c.counts.replied > 0 ? "good" : undefined} />
            <StatTile label={t("campaigns.bounced")} value={c.counts.bounced} hint={`${c.bounceRatePercent}%`} tone={c.bounceRatePercent > 3 ? "bad" : undefined} />
            <StatTile label={t("campaigns.unsubscribed")} value={c.counts.unsubscribed} />
          </div>

          {/* Steps */}
          <section className="rounded-xl border border-border">
            <h3 className="text-sm font-bold px-4 py-3 border-b border-border">{t("campaigns.sequence")}</h3>
            <ol className="divide-y divide-border">
              {c.steps.map(s => (
                <li key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{s.number === 1 ? t("campaigns.sentFirst") : t("campaigns.afterDays", { count: s.delayDays })}</p>
                    <p className="text-sm font-medium truncate">{s.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-line">{s.body}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setPreview(s.number)}><Eye className="h-3.5 w-3.5" />{t("campaigns.preview")}</Button>
                </li>
              ))}
            </ol>
          </section>

          {/* Recipients */}
          <section className="rounded-xl border border-border overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">{t("campaigns.recipientsTitle")}</h3>
              <select className={`${SELECT} w-auto h-8 text-xs`} value={status} onChange={e => setStatus(e.target.value)} aria-label={t("campaigns.filterStatus")}>
                <option value="">{t("campaigns.allStatuses")}</option>
                {["pending", "active", "completed", "replied", "bounced", "unsubscribed", "stopped", "failed", "skipped"].map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
              {!ended && <Can permission="leadgen.campaigns.edit"><Button size="sm" className="gap-1.5 ms-auto" onClick={() => setPicking(true)}><Plus className="h-3.5 w-3.5" />{t("campaigns.addProspects")}</Button></Can>}
            </div>
            {recipients.isLoading ? <LoadingBlock />
              : (recipients.data?.items ?? []).length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{t("campaigns.noRecipients")}</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-muted/30"><tr><th className={TH}>{t("campaigns.col.business")}</th><th className={TH}>{t("campaigns.col.status")}</th><th className={TH}>{t("campaigns.col.step")}</th><th className={TH}>{t("campaigns.col.next")}</th><th className="w-10" /></tr></thead>
                    <tbody className="divide-y divide-border">
                      {recipients.data!.items.map(r => (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5"><p className="font-medium truncate max-w-[220px]">{r.prospectName}</p><p className="text-xs text-muted-foreground truncate max-w-[220px]">{r.email}</p></td>
                          <td className="px-4 py-2.5"><StatusPill status={r.status} />{r.lastError && <p className="text-[11px] text-destructive mt-1 max-w-[200px] truncate" title={r.lastError}>{r.lastError}</p>}</td>
                          <td className="px-4 py-2.5 tabular-nums">{r.currentStep}/{c.steps.length}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.nextSendAt ? formatDateTime(r.nextSendAt) : r.lastSentAt ? formatDate(r.lastSentAt, "relative") : "—"}</td>
                          <td className="px-2">{(r.status === "pending" || r.status === "active") && (
                            <Can permission="leadgen.campaigns.edit"><button className="p-1 text-muted-foreground hover:text-destructive" aria-label={t("campaigns.removeRecipient")} onClick={() => removeRecipients.mutate({ id: c.id, recipientIds: [r.id] })}><X className="h-3.5 w-3.5" /></button></Can>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <Pager page={page} pageSize={20} total={recipients.data?.total ?? 0} onPage={setPage} />
          </section>
        </>
      )}

      <AnimatePresence>
        {c && preview != null && <PreviewModal campaign={c} step={preview} onClose={() => setPreview(null)} />}
        {c && picking && <ProspectPicker campaignId={c.id} onClose={() => setPicking(false)} />}
        {c && confirmStop && <ConfirmDialog title={t("campaigns.stopTitle")} body={t("campaigns.stopBody")} confirmLabel={t("campaigns.stop")} pending={stop.isPending}
          onClose={() => setConfirmStop(false)} onConfirm={() => stop.mutate(c.id, { onSuccess: () => setConfirmStop(false) })} />}
      </AnimatePresence>
    </Modal>
  );
}

function PreviewModal({ campaign, step, onClose }: { campaign: CampaignDto; step: number; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const q = usePreviewEmail(campaign.id, step);
  const test = useTestCampaign();
  const [to, setTo] = React.useState("");
  return (
    <Modal layer={60} size="md" onClose={onClose} title={t("preview.title", { n: step })} subtitle={t("preview.subtitle")}>
      {q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBlock error={q.error as Error} /> : q.data && (
        <>
          {q.data.warnings.map((w, i) => <Banner key={i} tone="warn">{w}</Banner>)}
          <div className="rounded-lg border border-border bg-background">
            <div className="px-4 py-3 border-b border-border text-sm space-y-0.5">
              <p><span className="text-muted-foreground">{t("preview.to")}</span> {q.data.to}</p>
              <p><span className="text-muted-foreground">{t("preview.subject")}</span> <span className="font-semibold">{q.data.subject}</span></p>
            </div>
            <pre className="px-4 py-4 text-sm whitespace-pre-wrap font-sans leading-relaxed" dir="auto">{q.data.body}</pre>
          </div>
          <Can anyOf={["leadgen.campaigns.edit", "leadgen.campaigns.send"]}>
            <Field label={t("preview.sendTest")} hint={t("preview.testHint")}>
              <div className="flex gap-2">
                <Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="you@company.com" />
                <Button variant="outline" className="gap-2 shrink-0" disabled={!to.includes("@") || test.isPending} onClick={() => test.mutate({ id: campaign.id, step, to })}>
                  {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t("preview.send")}
                </Button>
              </div>
            </Field>
          </Can>
        </>
      )}
    </Modal>
  );
}

/** Picks who gets the campaign. Only people the campaign could actually email are offered. */
function ProspectPicker({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search, 300);
  const list = useProspects({ revealed: true, hasEmail: true, search: debounced || undefined, sort: "fit", page, pageSize: 25 });
  const add = useAddRecipients();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<AddRecipientsResult | null>(null);
  React.useEffect(() => { setPage(1); }, [debounced]);

  const rows = (list.data?.items ?? []).filter(p => !p.suppressed && p.status !== "do_not_contact");
  const all = rows.length > 0 && rows.every(r => picked.has(r.id));
  const toggle = (id: string) => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Modal layer={60} size="lg" onClose={onClose} title={t("picker.title")} subtitle={t("picker.subtitle")}
      footer={result ? <Button onClick={onClose}>{t("action.done")}</Button> : (
        <>
          <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
          <Button disabled={picked.size === 0 || add.isPending} className="gap-2" onClick={() => add.mutate({ id: campaignId, prospectIds: [...picked] }, { onSuccess: setResult })}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("picker.add", { count: picked.size })}
          </Button>
        </>
      )}>
      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><StatTile label={t("addToCampaign.added")} value={result.added} tone={result.added > 0 ? "good" : undefined} /><StatTile label={t("addToCampaign.skipped")} value={result.noEmail + result.notSendable + result.suppressed + result.duplicate + result.notRevealed} /></div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {result.duplicate > 0 && <li>• {t("addToCampaign.duplicate", { count: result.duplicate })}</li>}
            {result.notSendable > 0 && <li>• {t("addToCampaign.notSendable", { count: result.notSendable })}</li>}
            {result.suppressed > 0 && <li>• {t("addToCampaign.suppressed", { count: result.suppressed })}</li>}
            {result.noEmail > 0 && <li>• {t("addToCampaign.noEmail", { count: result.noEmail })}</li>}
          </ul>
        </div>
      ) : (
        <>
          <SearchBox value={search} onChange={setSearch} placeholder={t("prospects.searchPlaceholder")} />
          {list.isLoading ? <LoadingBlock /> : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{t("picker.empty")}</p> : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 text-xs">
                <Checkbox checked={all} onCheckedChange={() => setPicked(s => { const n = new Set(s); rows.forEach(r => (all ? n.delete(r.id) : n.add(r.id))); return n; })} aria-label={t("prospects.selectAll")} />
                <span className="text-muted-foreground">{t("picker.selectPage")}</span>
              </div>
              <ul className="divide-y divide-border max-h-[46vh] overflow-y-auto">
                {rows.map(p => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 cursor-pointer" onClick={() => toggle(p.id)}>
                    <Checkbox checked={picked.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.name} />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{p.name}</p><p className="text-xs text-muted-foreground truncate">{p.email}</p></div>
                    <EmailStatusPill status={p.emailStatus} /><StatusPill status={p.status} />
                  </li>
                ))}
              </ul>
              <Pager page={page} pageSize={25} total={list.data?.total ?? 0} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
