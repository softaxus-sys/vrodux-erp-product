import * as React from "react";
import { Loader2, Plus, X, Play, FileText, SkipForward, Info, CalendarDays, Search, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useCompetitors, useCompetitorScan, useAddCompetitor, useRemoveCompetitor, useStartCompetitorScan, useDraftPlanItem, useSkipPlanItem,
} from "@/hooks/seo/use-seo-competitors";
import type { PlanItemDto } from "@/lib/seo/seo-competitors.api";

type View = "plan" | "keywords" | "topics";

/** Compare a website with up to five competitors: what they cover that it does not, and a 30-day plan to close the gap. */
export function CompetitorsTab({ siteId }: { siteId: string }) {
  const { hasRawPermission } = useAuthStore();
  const canEdit = hasRawPermission("seo.sites.edit");
  const canDraft = hasRawPermission("seo.content.edit");
  const { data: ov, isLoading } = useCompetitors(siteId);
  const scanId = ov?.latestScan?.id ?? null;
  const { data: scan } = useCompetitorScan(scanId, ov?.latestScan?.status);
  const add = useAddCompetitor();
  const remove = useRemoveCompetitor();
  const start = useStartCompetitorScan();
  const [domain, setDomain] = React.useState("");
  const [location, setLocation] = React.useState<number>(2784);
  const [view, setView] = React.useState<View>("plan");

  if (isLoading || !ov) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const latest = ov.latestScan;
  const running = latest?.status === "queued" || latest?.status === "running";
  const full = ov.competitors.length >= ov.max;
  const enough = ov.balance >= ov.estimatedCredits;

  const submit = async () => {
    const d = domain.trim();
    if (!d) return;
    try { await add.mutateAsync({ siteId, domain: d }); setDomain(""); } catch { /* hook toasts */ }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Your competitors</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add up to {ov.max} websites you compete with. We read their pages, compare them with yours, and suggest what to publish.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ov.competitors.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 pl-3 pr-1.5 py-1 text-sm">
              {c.domain}
              {canEdit && (
                <button onClick={() => remove.mutate(c.id)} disabled={running} aria-label={`Remove ${c.domain}`}
                  className="p-0.5 rounded-full hover:bg-muted text-muted-foreground disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>
              )}
            </span>
          ))}
          {ov.competitors.length === 0 && <span className="text-sm text-muted-foreground">No competitors yet.</span>}
        </div>

        {canEdit && !full && (
          <div className="flex gap-2">
            <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="competitor.com" className="max-w-xs"
              onKeyDown={e => { if (e.key === "Enter") submit(); }} />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={submit} disabled={add.isPending || !domain.trim()}>
              {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Add
            </Button>
          </div>
        )}
        {full && <p className="text-xs text-muted-foreground">That is the maximum. Remove one to add another.</p>}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium">Search market
            <select value={location} onChange={e => setLocation(Number(e.target.value))} disabled={running}
              className="mt-1 block h-9 rounded-md border border-border bg-card px-2 text-sm">
              {ov.locations.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          {canEdit && (
            <Button size="sm" className="gap-1.5" disabled={running || ov.competitors.length === 0 || !enough || start.isPending}
              onClick={() => start.mutate({ siteId, locationCode: location })}>
              {running || start.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? "Comparing…" : "Run comparison"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Uses up to <b>{ov.estimatedCredits}</b> credits (you have {ov.balance.toLocaleString()}). That covers reading up to {ov.pagesPerDomain} pages per website
          {ov.keywordDataAvailable ? `, plus ${ov.creditsPerCompetitorKeywords} credits per competitor for search-volume data` : ""}. You are charged for what is actually used, and nothing if it fails.
          Search-volume data is reused for 30 days, so repeating the comparison soon costs less.
        </p>
        {!enough && ov.competitors.length > 0 && (
          <p className="text-xs text-destructive">You do not have enough credits for this. Buy more in Settings → Billing.</p>
        )}
        {!ov.keywordDataAvailable && (
          <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Search-volume data is not switched on for this platform yet. You will still get the page-topic comparison and a content plan.</p>
        )}
      </section>

      {latest?.status === "failed" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{latest.error ?? "The comparison failed."}</div>
      )}
      {running && (
        <div className="rounded-lg border border-border p-4 text-sm flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />Reading the websites. This usually takes a few minutes; you can leave this page.
        </div>
      )}

      {scan && latest?.status === "completed" && (
        <section className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Compared on {formatDate(scan.summary.completedAt)} · {scan.summary.pagesCrawled} pages read · {scan.summary.creditsCharged} credits used
            {scan.summary.keywordDataNote && <div className="mt-1 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{scan.summary.keywordDataNote}</div>}
          </div>

          <div className="flex gap-1 border-b border-border">
            {([["plan", "30-day plan", CalendarDays, scan.plan.length], ["keywords", "Keyword gaps", Search, scan.keywordGaps.length], ["topics", "Topic gaps", Layers, scan.topicGaps.length]] as const).map(([k, label, Icon, n]) => (
              <button key={k} onClick={() => setView(k)}
                className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-1.5",
                  view === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="w-3.5 h-3.5" />{label} <span className="text-xs text-muted-foreground">{n}</span>
              </button>
            ))}
          </div>

          {view === "plan" && <Plan items={scan.plan} canDraft={canDraft} />}

          {view === "keywords" && (scan.keywordGaps.length === 0
            ? <Empty text={scan.summary.keywordDataUsed ? "No clear keyword gaps were found." : "Keyword gaps need search-volume data, which was not available for this comparison."} />
            : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr><th className="text-start p-2">Keyword</th><th className="text-end p-2">Searches / month</th><th className="text-end p-2">Difficulty</th><th className="text-start p-2">Ranks</th></tr></thead>
                <tbody>{scan.keywordGaps.map(k => (
                  <tr key={k.keyword} className="border-t border-border">
                    <td className="p-2 font-medium">{k.keyword}</td>
                    <td className="p-2 text-end tabular-nums">{k.volume.toLocaleString()}</td>
                    <td className="p-2 text-end tabular-nums">{k.difficulty ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{k.competitor} #{k.position}{k.competitorCount > 1 ? ` (+${k.competitorCount - 1} more)` : ""}</td>
                  </tr>))}</tbody>
              </table></div>
            ))}

          {view === "topics" && (scan.topicGaps.length === 0
            ? <Empty text="No clear topic gaps were found." />
            : (
              <ul className="divide-y divide-border">{scan.topicGaps.map(t => (
                <li key={t.phrase} className="py-2.5">
                  <div className="text-sm font-medium">{t.phrase}</div>
                  <div className="text-xs text-muted-foreground">{t.competitors} competitor(s), {t.pages} page(s) — e.g.{" "}
                    <a href={t.exampleUrl} target="_blank" rel="noreferrer" className="underline">{t.exampleTitle}</a></div>
                </li>))}</ul>
            ))}
        </section>
      )}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;

function Plan({ items, canDraft }: { items: PlanItemDto[]; canDraft: boolean }) {
  const draft = useDraftPlanItem();
  const skip = useSkipPlanItem();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (items.length === 0) return <Empty text="Nothing to plan: your site already covers what these competitors do." />;

  return (
    <ul className="space-y-2">
      {items.map(i => (
        <li key={i.id} className={cn("rounded-lg border border-border p-3", i.status === "skipped" && "opacity-50")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{formatDate(i.plannedDate)} · {i.source === "keyword" ? "Search term" : "Topic"}
                {i.searchVolume != null && ` · ${i.searchVolume.toLocaleString()}/month`}{i.difficulty != null && ` · difficulty ${i.difficulty}`}</div>
              <div className="text-sm font-medium mt-0.5">{i.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{i.reason}</div>
            </div>
            <div className="shrink-0 flex gap-1.5">
              {i.status === "drafted" && <span className="text-xs text-emerald-600 dark:text-emerald-400 self-center">Draft written — see Content</span>}
              {i.status === "skipped" && <span className="text-xs text-muted-foreground self-center">Skipped</span>}
              {i.status === "planned" && canDraft && (
                <>
                  <Button size="sm" variant="outline" className="gap-1" disabled={busy === i.id}
                    onClick={async () => { setBusy(i.id); try { await draft.mutateAsync(i.id); } catch { /* toasted */ } finally { setBusy(null); } }}>
                    {busy === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}Write draft
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Skip" onClick={() => skip.mutate(i.id)}><SkipForward className="w-3.5 h-3.5" /></Button>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
