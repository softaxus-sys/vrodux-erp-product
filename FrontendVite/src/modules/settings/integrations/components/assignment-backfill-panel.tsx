import * as React from "react";
import { UserCheck, AlertTriangle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useAssignmentBackfillPreview, useApplyAssignmentBackfill } from "@/hooks/crm/use-integrations";
import type { LeadAssignmentCandidate } from "@/lib/crm/integrations.api";

/**
 * Assigns leads this integration created BEFORE the portal agent rules existed.
 *
 * Two deliberate steps. Assignment decides who can see a record — a lead filed to the wrong team
 * is invisible to the right one — so a bulk rewrite of ownership across a live pipeline is
 * previewed and approved rather than triggered by one click. Nothing is resolved until the button
 * is pressed, and nothing is written until the second one is.
 */
export function AssignmentBackfillPanel({ integrationId, canEdit }: { integrationId: string; canEdit: boolean }) {
  const [started, setStarted] = React.useState(false);
  const [includeAssigned, setIncludeAssigned] = React.useState(false);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const { data, isFetching, isError, error } =
    useAssignmentBackfillPreview(integrationId, includeAssigned, started);
  const apply = useApplyAssignmentBackfill();

  const resolvable = React.useMemo(
    () => (data?.candidates ?? []).filter(c => c.resolvedUserId),
    [data]);

  // Default to everything resolvable whenever a fresh preview lands, so the common case is one
  // more click rather than a hundred.
  React.useEffect(() => {
    setPicked(new Set(resolvable.map(c => c.leadId)));
  }, [resolvable]);

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const run = () => apply.mutate(
    { id: integrationId, leadIds: [...picked] },
    { onSuccess: () => setPicked(new Set()) });

  if (!started) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Assign historical leads</p>
            <p className="text-xs text-muted-foreground mt-1">
              Leads this integration created earlier keep whatever owner they were given at the time.
              This re-runs the current agent rules over them and shows you the result before anything changes.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setStarted(true)}>
          <Search className="h-3.5 w-3.5 me-1.5" /> Check what would change
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-foreground">Assign historical leads</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={includeAssigned}
            onChange={e => setIncludeAssigned(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border" />
          {/* Off by default: a lead someone already owns has usually been worked, and taking it
              from them because a map now says otherwise is worse than leaving it alone. */}
          Include leads that already have an owner
        </label>
      </div>

      {isFetching ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Working out who each lead belongs to…
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">{(error as Error)?.message}</p>
      ) : !data ? null : data.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No historical leads from this integration need an owner.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Checked",     value: data.total,        tone: "text-foreground" },
              { label: "Can assign",  value: data.resolvable,   tone: "text-success" },
              { label: "No match",    value: data.unresolvable, tone: "text-muted-foreground" },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-muted/40 py-2">
                <p className={cn("text-base font-bold leading-none", s.tone)}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {data.total >= 1000 && (
            <p className="text-xs text-warning">
              Showing the newest 1,000. Run it again afterwards to continue through the rest.
            </p>
          )}

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
            {data.candidates.map((c: LeadAssignmentCandidate) => {
              const can = !!c.resolvedUserId;
              return (
                <label key={c.leadId}
                  className={cn("flex items-start gap-3 p-3 text-sm",
                    can ? "cursor-pointer hover:bg-muted/40" : "opacity-60")}>
                  <input type="checkbox" disabled={!can} checked={picked.has(c.leadId)}
                    onChange={() => toggle(c.leadId)}
                    className="h-3.5 w-3.5 mt-1 rounded border-border shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground truncate">{c.leadName}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.phone && <span dir="ltr">{c.phone}</span>}
                      {c.listingReference && <span className="ms-2">Ref {c.listingReference}</span>}
                      {c.agentName && <span className="ms-2">Agent {c.agentName}</span>}
                    </p>
                    {can ? (
                      <p className="text-[11px] mt-0.5">
                        {c.currentOwnerName
                          ? <span className="text-muted-foreground">{c.currentOwnerName} → </span>
                          : null}
                        <span className="text-success font-medium">{c.resolvedUserName}</span>
                        {/* A lead with no team stays invisible to team leads, so say when one is missing. */}
                        {!c.resolvedTeamId && (
                          <span className="text-warning ms-1.5">· no team — only they will see it</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.reason}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {data.resolvable === 0 ? (
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              None of these can be matched yet. A Bayut listing only learns its agent from an enquiry
              that names one, so leads received before that has happened have nothing to match on.
            </p>
          ) : canEdit && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {picked.size} of {data.resolvable} selected.
              </p>
              <Button size="sm" disabled={picked.size === 0 || apply.isPending} onClick={run}>
                {apply.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                Assign {picked.size} lead{picked.size === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
