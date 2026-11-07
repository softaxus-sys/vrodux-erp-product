import * as React from "react";
import { toast } from "sonner";
import {
  Loader2, PlayCircle, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Coins, Sparkles, Check, TrendingUp, TrendingDown, Minus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  useSeoAudits, useSeoIssues, useSeoPages, useSeoCredits, useRunScanNow, useCatalogueSeo, useSuggestCatalogueSeo, useApplyCatalogueSeo,
} from "@/hooks/seo/use-seo";
import {
  SEVERITY_META, ruleLabel, affectedUrls, RULE_LABELS,
  type SiteDto, type IssueDto, type IssueSeverity, type AuditDto, type CatalogueSeoItemDto,
} from "@/lib/seo/seo.api";

const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low"];

function scoreTone(score: number) {
  return score >= 80 ? "text-success" : score >= 55 ? "text-amber-600" : "text-destructive";
}

function Spinner() {
  return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

// ── Credits ──────────────────────────────────────────────────────────────────

export function CreditsBadge() {
  const { data } = useSeoCredits();
  if (!data) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
      data.balance < 1 ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground")}
      title={`One credit checks about ${data.pagesPerCredit} pages. Up to ${data.maxPagesPerAudit} pages per audit.`}>
      <Coins className="h-3 w-3" />{data.balance.toLocaleString()} credit{data.balance === 1 ? "" : "s"}
    </span>
  );
}

/** The scan button: says what an audit will cost before it spends anything, and refuses when there is nothing to spend. */
export function ScanButton({ site }: { site: SiteDto }) {
  const [open, setOpen] = React.useState(false);
  const { data: credits } = useSeoCredits();
  const run = useRunScanNow();

  const per = credits?.pagesPerCredit ?? 25;
  const max = credits?.maxPagesPerAudit ?? 500;
  const expectedPages = Math.min(max, Math.max(site.lastPagesCrawled || 0, 50));
  const expectedCost = Math.max(1, Math.ceil(expectedPages / per));
  const balance = credits?.balance ?? 0;
  const capPages = Math.min(max, balance * per);

  const start = () =>
    run.mutate(site.id, {
      onSuccess: (r) => {
        setOpen(false);
        toast.success(`Audit finished: score ${r.score ?? "—"}/100, ${r.pagesCrawled ?? 0} pages, ${r.creditsCharged ?? 0} credit${r.creditsCharged === 1 ? "" : "s"} used.`);
      },
    });

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setOpen(true)} disabled={run.isPending}>
        {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        Run audit
      </Button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !run.isPending && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Run an audit of {site.domain}</h3>
                <p className="text-xs text-muted-foreground mt-1">We crawl your site the way a search engine does and check every page we reach.</p>
              </div>
              <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground" onClick={() => setOpen(false)} disabled={run.isPending}><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="font-medium">1 credit per {per} pages</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expected for this site</span><span className="font-medium">about {expectedCost} credit{expectedCost === 1 ? "" : "s"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">You have</span><span className={cn("font-medium", balance < 1 && "text-destructive")}>{balance.toLocaleString()} credits</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Page limit this time</span><span className="font-medium">{Math.min(capPages, max).toLocaleString()} pages</span></div>
            </div>
            <p className="text-xs text-muted-foreground">You are charged for the pages actually checked, and nothing if the audit fails. If you run out partway, the audit stops at the pages you can afford.</p>
            {balance < 1 && <p className="text-xs text-destructive">No credits left — ask your administrator to add more.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={run.isPending}>Cancel</Button>
              <Button size="sm" className="gap-1.5" onClick={start} disabled={run.isPending || balance < 1}>
                {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                {run.isPending ? "Auditing…" : "Start audit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Health: score, trend, issues ─────────────────────────────────────────────

function Trend({ audits }: { audits: AuditDto[] }) {
  const points = audits.filter((a) => a.status === "completed" && a.score != null).slice(0, 12).reverse();
  if (points.length < 2) return <p className="text-xs text-muted-foreground">The trend appears after the second audit.</p>;
  const w = 220, h = 48, step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p.score! / 100) * h).toFixed(1)}`).join(" ");
  const first = points[0].score!, last = points[points.length - 1].score!;
  const delta = last - first;
  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" role="img" aria-label={`Score trend over ${points.length} audits`}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={p.id} cx={i * step} cy={h - (p.score! / 100) * h} r={2.5} className="fill-primary" />)}
      </svg>
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
        {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {delta > 0 ? "+" : ""}{delta} since {formatDate(points[0].startedAt)}
      </span>
    </div>
  );
}

export function HealthPanel({ site }: { site: SiteDto }) {
  const { data: audits = [], isLoading: loadingAudits } = useSeoAudits(site.id);
  const [severity, setSeverity] = React.useState<IssueSeverity | "all">("all");
  const [showResolved, setShowResolved] = React.useState(false);
  const { data: issues = [], isLoading } = useSeoIssues(site.id, showResolved ? "resolved" : undefined);

  const latest = audits.find((a) => a.status === "completed");

  const groups = React.useMemo(() => {
    const filtered = issues.filter((i) => severity === "all" || i.severity === severity);
    const map = new Map<string, IssueDto[]>();
    for (const i of filtered) {
      const key = i.code || i.title;
      const list = map.get(key) ?? [];
      list.push(i);
      map.set(key, list);
    }
    const rank = (s: string) => SEVERITY_ORDER.indexOf(s as IssueSeverity);
    return [...map.entries()]
      .map(([key, list]) => ({ key, list, severity: list[0].severity, total: list.reduce((n, i) => n + (i.affectedCount ?? 1), 0) }))
      .sort((a, b) => rank(a.severity) - rank(b.severity) || b.total - a.total);
  }, [issues, severity]);

  if (loadingAudits) return <Spinner />;
  if (!latest) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No audit has completed yet. Run one to see this site's health score and what to fix.</div>;
  }

  const counts: Record<IssueSeverity, number> = {
    critical: latest.criticalCount ?? 0, high: latest.highCount ?? 0, medium: latest.mediumCount ?? 0, low: latest.lowCount ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4 flex flex-wrap items-center gap-5">
        <div className="text-center">
          <div className={cn("text-4xl font-bold tabular-nums", scoreTone(latest.score ?? 0))}>{latest.score ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Health score</div>
        </div>
        <div className="flex-1 min-w-[220px] space-y-2">
          <Trend audits={audits} />
          <p className="text-xs text-muted-foreground">
            {(latest.pagesCrawled ?? 0).toLocaleString()} pages checked on {formatDate(latest.startedAt)}
            {latest.newIssues ? ` · ${latest.newIssues} new` : ""}{latest.resolvedIssues ? ` · ${latest.resolvedIssues} fixed since last time` : ""}
            {latest.truncated ? " · more pages exist than were checked" : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setSeverity("all")}
          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", severity === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
          All ({issues.length})
        </button>
        {SEVERITY_ORDER.map((s) => (
          <button key={s} onClick={() => setSeverity(s)}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium border capitalize", severity === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
            {s} ({counts[s]})
          </button>
        ))}
        <label className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show fixed
        </label>
      </div>

      {isLoading ? <Spinner /> : groups.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">{showResolved ? "Nothing has been fixed yet." : "No open issues. Nice."}</div>
      ) : (
        <div className="space-y-2">{groups.map((g) => <IssueGroup key={g.key} code={g.key} list={g.list} total={g.total} />)}</div>
      )}
    </div>
  );
}

function IssueGroup({ code, list, total }: { code: string; list: IssueDto[]; total: number }) {
  const [open, setOpen] = React.useState(false);
  const [limit, setLimit] = React.useState(10);
  const first = list[0];
  const sev = SEVERITY_META[first.severity];
  const label = ruleLabel(first.code, first.title);
  return (
    <div className="rounded-xl border border-border">
      <button className="w-full flex items-start gap-2.5 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", sev.bg, sev.color)}>
              <AlertTriangle className="h-2.5 w-2.5" />{first.severity}
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{total} {total === 1 ? "page" : "pages"} affected{first.firstSeenAt ? ` · first seen ${formatDate(first.firstSeenAt)}` : ""}</p>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2.5">
          {code in RULE_LABELS && <p className="text-xs text-muted-foreground">{first.description}</p>}
          {list.slice(0, limit).map((i) => {
            const urls = affectedUrls(i);
            return (
              <div key={i.id} className="text-xs space-y-1">
                {i.pageUrl ? (
                  <a href={i.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground hover:underline break-all">
                    <ExternalLink className="h-3 w-3 shrink-0" />{i.pageUrl}
                  </a>
                ) : <span className="text-foreground">Whole site</span>}
                {(i.affectedCount ?? 1) > 1 && urls.length > 0 && (
                  <ul className="ms-4 list-disc text-muted-foreground space-y-0.5">
                    {urls.slice(0, 8).map((u) => <li key={u} className="break-all">{u}</li>)}
                    {(i.affectedCount ?? 0) > urls.length && <li>and {(i.affectedCount ?? 0) - urls.length} more</li>}
                  </ul>
                )}
              </div>
            );
          })}
          {list.length > limit && <button className="text-xs text-primary hover:underline" onClick={() => setLimit(limit + 20)}>Show {Math.min(20, list.length - limit)} more</button>}
        </div>
      )}
    </div>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────

type PageSort = "issues" | "slow" | "words" | "status";

export function PagesPanel({ siteId }: { siteId: string }) {
  const { data: pages = [], isLoading } = useSeoPages(siteId);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<PageSort>("issues");
  const [limit, setLimit] = React.useState(50);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = pages.filter((p) => !needle || p.url.toLowerCase().includes(needle) || (p.title ?? "").toLowerCase().includes(needle));
    const by: Record<PageSort, (a: typeof pages[number], b: typeof pages[number]) => number> = {
      issues: (a, b) => b.issueCount - a.issueCount,
      slow: (a, b) => b.responseMs - a.responseMs,
      words: (a, b) => a.wordCount - b.wordCount,
      status: (a, b) => b.statusCode - a.statusCode,
    };
    return [...filtered].sort(by[sort]);
  }, [pages, q, sort]);

  if (isLoading) return <Spinner />;
  if (pages.length === 0) return <div className="text-center py-10 text-sm text-muted-foreground">No pages recorded yet. Run an audit first.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address or title" className="h-8 max-w-xs" />
        <select value={sort} onChange={(e) => setSort(e.target.value as PageSort)} className="h-8 rounded-md border border-border bg-card px-2 text-xs">
          <option value="issues">Most issues first</option>
          <option value="slow">Slowest first</option>
          <option value="words">Thinnest content first</option>
          <option value="status">Errors first</option>
        </select>
        <span className="text-xs text-muted-foreground ms-auto">{rows.length} of {pages.length} pages</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-start font-medium px-3 py-2">Page</th>
              <th className="text-end font-medium px-2 py-2">Status</th>
              <th className="text-end font-medium px-2 py-2">Time</th>
              <th className="text-end font-medium px-2 py-2">Words</th>
              <th className="text-end font-medium px-2 py-2">Links in</th>
              <th className="text-end font-medium px-3 py-2">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => (
              <tr key={p.id} className="border-t border-border align-top">
                <td className="px-3 py-2 max-w-[280px]">
                  <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-foreground hover:underline" title={p.url}>{p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</a>
                  <span className="block truncate text-muted-foreground">{p.title || (p.error ?? "No title")}</span>
                  <span className="mt-0.5 inline-flex gap-1">
                    {!p.indexable && <span className="rounded bg-muted px-1 text-[10px]">not indexable</span>}
                    {p.inSitemap && <span className="rounded bg-muted px-1 text-[10px]">in sitemap</span>}
                    {p.redirectHops > 0 && <span className="rounded bg-amber-50 text-amber-700 px-1 text-[10px]">{p.redirectHops} redirect{p.redirectHops === 1 ? "" : "s"}</span>}
                  </span>
                </td>
                <td className={cn("px-2 py-2 text-end tabular-nums", p.statusCode >= 400 || p.statusCode === 0 ? "text-destructive font-medium" : "")}>{p.statusCode || "—"}</td>
                <td className={cn("px-2 py-2 text-end tabular-nums", p.responseMs >= 1500 && "text-amber-600")}>{p.responseMs} ms</td>
                <td className="px-2 py-2 text-end tabular-nums">{p.wordCount}</td>
                <td className="px-2 py-2 text-end tabular-nums">{p.internalLinksIn}</td>
                <td className={cn("px-3 py-2 text-end tabular-nums", p.issueCount > 0 && "font-medium text-foreground")}>{p.issueCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <button className="text-xs text-primary hover:underline" onClick={() => setLimit(limit + 100)}>Show more</button>}
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

export function HistoryPanel({ siteId }: { siteId: string }) {
  const { data: audits = [], isLoading } = useSeoAudits(siteId);
  if (isLoading) return <Spinner />;
  if (audits.length === 0) return <div className="text-center py-10 text-sm text-muted-foreground">No audits have run yet.</div>;
  return (
    <div className="space-y-2">
      {audits.map((a) => (
        <div key={a.id} className="rounded-lg border border-border px-3.5 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-foreground">{formatDate(a.startedAt)}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {a.score != null && <span className={cn("font-semibold tabular-nums", scoreTone(a.score))}>{a.score}/100</span>}
              <span className={cn("px-1.5 py-0.5 rounded font-semibold uppercase text-[10px]",
                a.status === "completed" ? "bg-success/10 text-success" : a.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{a.status}</span>
            </div>
          </div>
          {a.status === "completed" && (
            <p className="text-xs text-muted-foreground mt-1">
              {(a.pagesCrawled ?? 0).toLocaleString()} pages · {a.issuesFound} open issue{a.issuesFound === 1 ? "" : "s"}
              {a.newIssues ? ` · ${a.newIssues} new` : ""}{a.resolvedIssues ? ` · ${a.resolvedIssues} fixed` : ""} · {a.fixesProposed} fix{a.fixesProposed === 1 ? "" : "es"} proposed
              {a.creditsCharged ? ` · ${a.creditsCharged} credit${a.creditsCharged === 1 ? "" : "s"}` : ""}
            </p>
          )}
          {a.error && <p className={cn("text-xs mt-1", a.status === "failed" ? "text-destructive" : "text-amber-600")}>{a.error}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Catalogue SEO ────────────────────────────────────────────────────────────

export function CatalogueSeoPanel({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, error } = useCatalogueSeo();
  const [onlyProblems, setOnlyProblems] = React.useState(true);
  const [limit, setLimit] = React.useState(30);

  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="text-center py-10 text-sm text-destructive">{(error as Error)?.message ?? "Could not load the catalogue."}</div>;

  const items = data.items.filter((i) => !onlyProblems || i.problems.length > 0);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 flex flex-wrap items-center gap-5">
        <div className="text-center">
          <div className={cn("text-3xl font-bold tabular-nums", scoreTone(data.averageScore))}>{data.averageScore}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Catalogue score</div>
        </div>
        <p className="text-xs text-muted-foreground flex-1 min-w-[220px]">
          {data.total} online listing{data.total === 1 ? "" : "s"}, {data.withProblems} with something to improve. Changes are saved to the listing itself, so your storefront, Google and any connected store all use the same text.
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Only those needing work
        </label>
      </div>
      {items.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">{data.total === 0 ? "No product listings yet." : "Every listing looks good."}</div> : (
        <div className="space-y-2">{items.slice(0, limit).map((i) => <CatalogueRow key={i.id} item={i} canEdit={canEdit} />)}</div>
      )}
      {items.length > limit && <button className="text-xs text-primary hover:underline" onClick={() => setLimit(limit + 30)}>Show more</button>}
    </div>
  );
}

function CatalogueRow({ item, canEdit }: { item: CatalogueSeoItemDto; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(item.seoTitle ?? "");
  const [desc, setDesc] = React.useState(item.metaDescription ?? "");
  const suggest = useSuggestCatalogueSeo();
  const apply = useApplyCatalogueSeo();

  React.useEffect(() => { setTitle(item.seoTitle ?? ""); setDesc(item.metaDescription ?? ""); }, [item.seoTitle, item.metaDescription]);

  const ask = () => suggest.mutate(item.id, {
    onSuccess: (s) => { setTitle(s.seoTitle); setDesc(s.metaDescription); setOpen(true); if (s.note) toast.info(s.note); },
  });
  const dirty = title.trim() !== (item.seoTitle ?? "") || desc.trim() !== (item.metaDescription ?? "");

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-3 p-3">
        <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.problems.map((p) => <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{RULE_LABELS[p] ?? p}</span>)}
            {item.problems.length === 0 && <span className="text-[11px] text-success">Looks good</span>}
          </div>
        </button>
        <span className={cn("text-sm font-bold tabular-nums", scoreTone(item.score))}>{item.score}</span>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={ask} disabled={suggest.isPending}>
            {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Suggest
          </Button>
        )}
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Search title <span className={cn((title.length > 60 || title.length < 20) && "text-amber-600")}>({title.length}/60)</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} maxLength={70} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Meta description <span className={cn((desc.length > 160 || desc.length < 70) && "text-amber-600")}>({desc.length}/160)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!canEdit} maxLength={320} rows={3}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">How it may look on Google</p>
            <p className="text-sm text-primary truncate">{title || item.name}</p>
            <p className="text-[11px] text-success truncate">/products/{item.slug}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{desc || "No description — Google will pick text from the page."}</p>
          </div>
          {(item.imageCount === 0 || item.imagesMissingAlt > 0 || item.descriptionWords < 40) && (
            <p className="text-xs text-muted-foreground">
              {item.imageCount === 0 ? "Add at least one photo. " : item.imagesMissingAlt > 0 ? `${item.imagesMissingAlt} photo${item.imagesMissingAlt === 1 ? "" : "s"} have no description (alt text). ` : ""}
              {item.descriptionWords < 40 ? `The description is only ${item.descriptionWords} words — fix these in Inventory → Online Listings.` : ""}
            </p>
          )}
          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={!dirty || apply.isPending || (!title.trim() && !desc.trim())}
                onClick={() => apply.mutate({ id: item.id, body: { seoTitle: title.trim() || undefined, metaDescription: desc.trim() || undefined } })}>
                {apply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save to listing
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
