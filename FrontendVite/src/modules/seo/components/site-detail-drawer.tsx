import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Check, XCircle, PlayCircle, RefreshCw, ExternalLink,
  AlertTriangle, Clock, Globe, Settings2,
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

type Tab = "fixes" | "history";

export function SiteDetailDrawer({ siteId, onClose }: { siteId: string | null; onClose: () => void }) {
  const [tab, setTab] = React.useState<Tab>("fixes");
  const { data: site } = useSeoSite(siteId);
  const runScan = useRunScanNow();

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
              {(["fixes", "history"] as Tab[]).map(tKey => (
                <button key={tKey} onClick={() => setTab(tKey)}
                  className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === tKey ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {tKey === "fixes" ? "Fixes to review" : "Audit history"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === "fixes" ? <FixesReviewList siteId={site.id} /> : <AuditHistoryList siteId={site.id} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusStrip({ site }: { site: NonNullable<ReturnType<typeof useSeoSite>["data"]> }) {
  const rotate = useRotateSnippetKey();
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20 text-xs shrink-0 flex-wrap">
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
      <button onClick={() => rotate.mutate(site.id)} className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <RefreshCw className="h-3 w-3" />Rotate snippet key
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
