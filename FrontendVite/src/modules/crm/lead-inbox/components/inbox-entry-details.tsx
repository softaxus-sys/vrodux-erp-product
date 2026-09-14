import * as React from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/auth/can";
import { useLeadInboxEntry, useRetryLeadInboxEntry } from "@/hooks/crm/use-integrations";
import { formatDate, cn } from "@/lib/utils";

/**
 * Everything known about one inbound delivery, including the payload the provider sent.
 *
 * Shared by the Lead Inbox page's drawer and the Inbound Log tab in Settings → Integrations, so the
 * two can never disagree about what a delivery says. Fetches by entry id on demand: the list
 * endpoints deliberately omit the payload, which is the largest field by far and unread until
 * someone opens a row.
 */

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",      color: "text-warning",          bg: "bg-warning/10" },
  processing: { label: "Processing",   color: "text-primary",          bg: "bg-primary/10" },
  processed:  { label: "Lead created", color: "text-success",          bg: "bg-success/10" },
  duplicate:  { label: "Duplicate",    color: "text-muted-foreground", bg: "bg-muted" },
  failed:     { label: "Failed",       color: "text-destructive",      bg: "bg-destructive/10" },
};

/** Status is a plain string column, so a value outside the map is possible; a bare index would
 *  read undefined and take the page down on `.color`. */
export const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: s || "Unknown", color: "text-muted-foreground", bg: "bg-muted" };

export function StatusPill({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", m.color, m.bg)}>
      {m.label}
    </span>
  );
}

/** Pretty-print JSON when it is JSON; show the body verbatim when it is not (form posts are not). */
function formatPayload(raw: string): { text: string; isJson: boolean } {
  try { return { text: JSON.stringify(JSON.parse(raw), null, 2), isJson: true }; }
  catch { return { text: raw, isJson: false }; }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function InboxEntryDetails({
  entryId,
  showStatus = true,
  onRetried,
}: {
  entryId: string;
  /** The drawer shows status in its own field grid; a list row already shows it beside the id. */
  showStatus?: boolean;
  onRetried?: () => void;
}) {
  const { data: entry, isLoading, isError, error } = useLeadInboxEntry(entryId);
  const retry = useRetryLeadInboxEntry();
  const canRetry = useCan("settings.integrations.edit");

  const payload = React.useMemo(() => (entry ? formatPayload(entry.payload) : null), [entry]);

  const copy = async () => {
    if (!payload) return;
    try { await navigator.clipboard.writeText(payload.text); toast.success("Payload copied."); }
    catch { toast.error("Could not copy to the clipboard."); }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the payload…</p>;
  if (isError || !entry) {
    return (
      <p className="text-sm text-destructive">
        {(error as Error)?.message ?? "This delivery could not be loaded."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {showStatus && <Field label="Status"><StatusPill status={entry.status} /></Field>}
        <Field label="Received">{formatDate(entry.receivedAt)}</Field>
        <Field label="Provider reference">
          <span className="font-mono text-xs break-all">{entry.externalId || "—"}</span>
        </Field>
        <Field label="Attempts">{entry.attempts}</Field>
        {entry.processedAt   && <Field label="Processed">{formatDate(entry.processedAt)}</Field>}
        {entry.nextAttemptAt && <Field label="Next attempt">{formatDate(entry.nextAttemptAt)}</Field>}
      </div>

      {entry.createdLeadId && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-xs font-semibold text-success uppercase tracking-wide mb-1">
            {entry.status === "duplicate" ? "Matched an existing lead" : "Created lead"}
          </p>
          <Link to="/crm/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary">
            {entry.createdLeadName || "View in Leads"}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {entry.lastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Error</p>
          <p className="text-sm text-foreground break-words">{entry.lastError}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Raw payload
            {!payload?.isJson && <span className="normal-case font-normal"> (not JSON — shown as sent)</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={copy} className="h-7 gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
        {/* Forced LTR: a payload is machine text and must not be mirrored in an RTL locale. */}
        <pre dir="ltr"
          className="text-[11px] leading-relaxed font-mono bg-muted/50 border border-border rounded-lg p-3 overflow-x-auto max-h-[45vh] whitespace-pre-wrap break-words text-start">
          {payload?.text}
        </pre>
      </div>

      {entry.status === "failed" && canRetry && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            The payload is stored, so this can be reprocessed without asking the portal to resend.
          </p>
          <Button size="sm" disabled={retry.isPending}
            onClick={() => retry.mutate(entry.id, { onSuccess: () => onRetried?.() })}>
            <RefreshCw className={cn("h-3.5 w-3.5 me-1.5", retry.isPending && "animate-spin")} />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
