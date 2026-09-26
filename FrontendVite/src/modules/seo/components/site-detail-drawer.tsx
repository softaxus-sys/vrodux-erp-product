import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Check, XCircle, PlayCircle, RefreshCw, ExternalLink,
  AlertTriangle, Clock, Globe, Settings2, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  useSeoSite, useSeoAudits, useSeoFixes, useRunScanNow,
  useApproveFix, useRejectFix, useRotateSnippetKey,
} from "@/hooks/seo/use-seo";
import {
  proposedValue, SEVERITY_META, FIX_STATUS_META, CHANGE_TYPE_LABELS,
  type FixDto,
} from "@/lib/seo/seo.api";
import { ContentTab } from "./content-tab";
import { useAuthStore } from "@/store/auth.store";

type Tab = "fixes" | "history" | "content";

export function SiteDetailDrawer({ siteId, onClose }: { siteId: string | null; onClose: () => void }) {
  const [tab, setTab] = React.useState<Tab>("fixes");
  const { data: site } = useSeoSite(siteId);
  const runScan = useRunScanNow();
  const { hasRawPermission } = useAuthStore();
  const canSeeContent = hasRawPermission("seo.content.view");

  React.useEffect(() => { if (siteId) setTab("fixes"); }, [siteId]);

  return (
    <AnimatePresence>
      {siteId && site && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground truncate">{site.displayName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{site.domain}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5 h-8"
                  disabled={runScan.isPending} onClick={() => runScan.mutate(site.id)}>
                  {runScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                  Scan now
                </Button>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <StatusStrip site={site} />

            <div className="flex items-center gap-1 px-6 pt-3 border-b border-border shrink-0">
              {(["fixes", ...(canSeeContent ? ["content"] as Tab[] : []), "history"] as Tab[]).map(tKey => (
                <button key={tKey} onClick={() => setTab(tKey)}
                  className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === tKey ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {tKey === "fixes" ? "Fixes to review" : tKey === "content" ? "Content" : "Audit history"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === "fixes" && <FixesReviewList siteId={site.id} />}
              {tab === "content" && <ContentTab siteId={site.id} domain={site.domain} />}
              {tab === "history" && <AuditHistoryList siteId={site.id} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusStrip({ site }: { site: NonNullable<ReturnType<typeof useSeoSite>["data"]> }) {
  const rotate = useRotateSnippetKey();
  const { refetch, isFetching } = useSeoSite(site.id);
  const [lastCheckedAt, setLastCheckedAt] = React.useState<Date | null>(null);
  const [showTag, setShowTag] = React.useState(false);

  // Self-updates while unverified — leaving this open is enough, no click required. Mirrors the
  // wizard's own step-2 polling; this is the recheck surface that exists everywhere ELSE the site
  // is viewed from (there was previously no way to recheck outside the wizard at all).
  React.useEffect(() => {
    if (site.verificationStatus === "verified") return;
    const id = setInterval(() => refetch(), 5000);
    return () => clearInterval(id);
  }, [site.verificationStatus, refetch]);

  const handleRecheck = async () => {
    await refetch();
    setLastCheckedAt(new Date());
  };

  const snippetOrigin = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}`;
  const snippetTag = `<script src="${snippetOrigin}/api/seo/snippet/${site.snippetKey}/tag.js" async></script>`;

  return (
    <div className="border-b border-border bg-muted/20 shrink-0">
      <div className="flex items-center gap-4 px-6 py-3 text-xs flex-wrap">
        <span className={cn("inline-flex items-center gap-1.5 font-medium",
          site.verificationStatus === "verified" ? "text-success" : "text-amber-600")}>
          <Globe className="h-3.5 w-3.5" />
          {site.verificationStatus === "verified" ? "Snippet verified" : "Snippet not yet verified"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          {site.googleConnected ? "Google connected" : "Google not connected"}
        </span>
        {site.lastScanAt && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />Last scan {formatDate(site.lastScanAt)}
          </span>
        )}

        <div className="ms-auto flex items-center gap-3">
          {site.verificationStatus !== "verified" && (
            <button onClick={handleRecheck} disabled={isFetching}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 font-medium disabled:opacity-60">
              {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Recheck now
            </button>
          )}
          <button onClick={() => setShowTag(v => !v)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Show snippet
          </button>
          <button onClick={() => rotate.mutate(site.id)}
            title="Generates a new key — the tag already on your site will stop working until you replace it"
            className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />Rotate key
          </button>
        </div>
      </div>

      {site.verificationStatus !== "verified" && (
        <div className="px-6 pb-3 -mt-1 text-[11px] text-muted-foreground">
          {isFetching ? "Checking…" : lastCheckedAt ? `Still not verified — checked ${lastCheckedAt.toLocaleTimeString()}. ` : "Auto-checking every few seconds. "}
          {!isFetching && (
            <>If it stays like this, open your site's browser console — a warning there will name the likely cause (a Content-Security-Policy blocking the request is the most common one).</>
          )}
        </div>
      )}

      {showTag && (
        <div className="px-6 pb-3">
          <SnippetPreview code={snippetTag} />
        </div>
      )}
    </div>
  );
}

function SnippetPreview({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-2.5 pr-10 text-[11px] overflow-x-auto font-mono" dir="ltr">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 border border-border hover:bg-background"
        title="Copy">
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function FixesReviewList({ siteId }: { siteId: string }) {
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>("pending_review");
  const { data: fixes = [], isLoading } = useSeoFixes(siteId, statusFilter);
  const approve = useApproveFix();
  const reject = useRejectFix();

  const filters: { key: string | undefined; label: string }[] = [
    { key: "pending_review", label: "Pending review" },
    { key: "applied", label: "Applied" },
    { key: "rejected", label: "Rejected" },
    { key: undefined, label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map(f => (
          <button key={f.label} onClick={() => setStatusFilter(f.key)}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : fixes.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No fixes here yet. Run a scan to have the AI agent propose some.
        </div>
      ) : (
        <div className="space-y-3">
          {fixes.map(fix => (
            <FixCard key={fix.id} fix={fix}
              onApprove={() => approve.mutate({ id: fix.id })}
              onReject={() => reject.mutate(fix.id)}
              pending={approve.isPending || reject.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function FixCard({ fix, onApprove, onReject, pending }: { fix: FixDto; onApprove: () => void; onReject: () => void; pending: boolean }) {
  const sevMeta = SEVERITY_META[fix.issueSeverity];
  const statusMeta = FIX_STATUS_META[fix.status];
  const value = proposedValue(fix);

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", sevMeta.bg, sevMeta.color)}>
              <AlertTriangle className="h-2.5 w-2.5" />{fix.issueSeverity}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{CHANGE_TYPE_LABELS[fix.changeType]}</span>
            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", statusMeta.bg, statusMeta.color)}>
              {fix.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground mt-1">{fix.issueTitle}</p>
          {fix.pageUrl && (
            <a href={fix.pageUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" />{fix.pageUrl}
            </a>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Proposed change</p>
        <p className="text-sm text-foreground break-words">{value}</p>
      </div>

      <p className="text-xs text-muted-foreground italic">{fix.rationale}</p>

      {fix.status === "pending_review" ? (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="gap-1.5 h-8" disabled={pending} onClick={onApprove}>
            <Check className="h-3.5 w-3.5" />Approve — apply live
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive hover:text-destructive" disabled={pending} onClick={onReject}>
            <XCircle className="h-3.5 w-3.5" />Reject
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {fix.status === "applied" && fix.appliedAt && `Applied ${formatDate(fix.appliedAt)}${fix.reviewedByName ? ` by ${fix.reviewedByName}` : ""}`}
          {fix.status === "rejected" && fix.reviewedAt && `Rejected ${formatDate(fix.reviewedAt)}${fix.reviewedByName ? ` by ${fix.reviewedByName}` : ""}`}
        </p>
      )}
    </div>
  );
}

function AuditHistoryList({ siteId }: { siteId: string }) {
  const { data: audits = [], isLoading } = useSeoAudits(siteId);

  if (isLoading) return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (audits.length === 0) return <div className="text-center py-10 text-sm text-muted-foreground">No scans have run yet.</div>;

  return (
    <div className="space-y-2">
      {audits.map(a => (
        <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-sm">
          <div>
            <p className="font-medium text-foreground">{formatDate(a.startedAt)}</p>
            {a.error && <p className="text-xs text-destructive mt-0.5">{a.error}</p>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{a.issuesFound} issue{a.issuesFound === 1 ? "" : "s"}</span>
            <span>{a.fixesProposed} fix{a.fixesProposed === 1 ? "" : "es"} proposed</span>
            <span className={cn("px-1.5 py-0.5 rounded font-semibold uppercase text-[10px]",
              a.status === "completed" ? "bg-success/10 text-success" : a.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
              {a.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
