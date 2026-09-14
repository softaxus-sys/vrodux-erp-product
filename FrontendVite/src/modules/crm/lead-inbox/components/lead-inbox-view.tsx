import * as React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Search, RefreshCw, AlertTriangle, CheckCircle2, Copy, X,
  ChevronLeft, ChevronRight, Clock, Files, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLeadInbox, useLeadInboxEntry } from "@/hooks/crm/use-integrations";
import { InboxEntryDetails, StatusPill, statusMeta } from "./inbox-entry-details";
import { LEAD_INBOX_STATUSES, type LeadInboxRow } from "@/lib/crm/integrations.api";
import { sourceLabel } from "@/lib/crm/crm.api";
import { formatDate, parseApiDate, cn } from "@/lib/utils";

/**
 * Every inbound delivery from every lead integration, with the raw payload each provider sent.
 *
 * This is the answer to "did Bayut actually send us that enquiry?" — a question neither the leads
 * list nor the integration cards can answer. A lead only exists once a payload has been mapped,
 * deduped and routed, so anything rejected along the way was previously invisible: the enquiry had
 * arrived, been stored, failed, and left no trace any user could see.
 */

function RelativeTime({ iso }: { iso: string }) {
  const d = parseApiDate(iso);
  if (!d) return <>—</>;
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const rel =
    mins < 1      ? "just now"
    : mins < 60   ? `${mins}m ago`
    : mins < 1440 ? `${Math.round(mins / 60)}h ago`
    : formatDate(iso);
  return <span title={d.toLocaleString()}>{rel}</span>;
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function EntryDrawer({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const { data: entry } = useLeadInboxEntry(entryId);

  return (
    <AnimatePresence>
      {entryId && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 w-full max-w-2xl bg-card border-s border-border z-50 flex flex-col">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground">Inbound delivery</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry ? `${entry.integrationName} · ${sourceLabel(entry.providerKey)}` : "Loading…"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <InboxEntryDetails entryId={entryId} onRetried={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</th>;
}

/**
 * Every inbound delivery for ONE connected integration, with the payload the provider sent.
 *
 * Scoped rather than tenant-wide on purpose: it lives inside the integration's own drawer, so a
 * Property Finder log must never show a Bayut payload. The source filter is dropped with it —
 * there is only one source in scope, and a filter with a single option is furniture.
 */
export function LeadInboxView({ integrationId }: { integrationId: string }) {
  const [search, setSearch]       = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus]       = React.useState("all");
  const [page, setPage]           = React.useState(1);
  const [openId, setOpenId]       = React.useState<string | null>(null);

  React.useEffect(() => {
    const h = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(h);
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useLeadInbox({ integrationId, page, pageSize: 25, status, search: debounced });

  const rows  = data?.items ?? [];
  const total = data?.totalCount ?? 0;
  const unfiltered = status === "all" && !debounced;

  // Counted from the rows on screen, and labelled "on this page" so the number is not read as a
  // total. A tenant-wide summary would be the wrong figure entirely inside a single integration.
  const count = (...s: string[]) => rows.filter(r => s.includes(r.status)).length;
  const stats = [
    { label: "Leads made", value: count("processed"),              icon: CheckCircle2,  color: "bg-success/10 text-success" },
    { label: "Duplicates", value: count("duplicate"),              icon: Files,         color: "bg-muted text-muted-foreground" },
    { label: "Waiting",    value: count("pending", "processing"),  icon: Clock,         color: "bg-warning/10 text-warning" },
    { label: "Failed",     value: count("failed"),                 icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {/* Direction stated outright. Only webhook deliveries land here — a poll calls intake
            directly and never creates an inbox row — so without saying so, an empty log reads as
            "nothing is arriving" when it may only mean "nothing is being PUSHED". */}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pushed to Vrodux by the portal</span>, newest
          first — with the payload it delivered. Leads Vrodux pulls are recorded under Sync History.
          {total > 0 && <span className="ms-1">Showing {rows.length} of {total} on this page.</span>}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 me-2", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search the payload — a phone number, an email, a listing reference…"
            className="ps-9 h-9" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          aria-label="Status"
          className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">All statuses</option>
          {LEAD_INBOX_STATUSES.map(s => <option key={s} value={s}>{statusMeta(s).label}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-10 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">The inbox could not be loaded.</p>
              <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : isLoading ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Loading deliveries…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">
                {unfiltered ? "Nothing has arrived yet." : "No deliveries match these filters."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {unfiltered
                  ? "Deliveries appear here the moment a connected source sends one."
                  : "Try a wider status or source."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <Th>Reference</Th><Th>Status</Th><Th>Lead</Th><Th>Received</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: LeadInboxRow) => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[14rem] truncate">
                        {r.externalId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {r.lastError && (
                          <p className="text-[11px] text-destructive mt-1 max-w-[18rem] truncate" title={r.lastError}>
                            {r.lastError}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.createdLeadName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap"><RelativeTime iso={r.receivedAt} /></td>
                      <td className="px-4 py-3 text-end"><span className="text-xs text-primary font-medium">View payload</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!data?.hasPrev} onClick={() => setPage(p => p - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={!data?.hasNext} onClick={() => setPage(p => p + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <EntryDrawer entryId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
