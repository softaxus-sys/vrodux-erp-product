import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamsForFiling } from "@/hooks/identity/use-assignable-by-team";

export interface FilingResult { filed: number; skipped: number; reassigned?: number }

/**
 * Bulk "file these records to a team" bar, shared by the Leads, Pipeline and Accounts lists.
 *
 * <p>Filing is what makes a record visible to a team lead — an unfiled record is visible only to its
 * owner and to full-access roles. Doing that one record at a time is impractical, and leaving deals
 * or accounts unfiled leaves every pipeline/forecast report empty for a team lead, so all three
 * lists get the same tool rather than only Leads.</p>
 *
 * <p>Selection lives in the parent (it belongs to the list), so this component stays presentational
 * apart from the team dropdown and the mutation call.</p>
 */
export function TeamFilingBar({
  selectedCount, onFile, onClear, isPending,
}: {
  selectedCount: number;
  /** Runs the bulk mutation for the given team (null = un-file) and resolves with the tallies. */
  onFile: (teamId: string | null) => Promise<FilingResult>;
  onClear: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation("crm");
  const [teamId, setTeamId] = React.useState("");
  const { teams } = useTeamsForFiling();

  if (selectedCount === 0) return null;

  const apply = async () => {
    try {
      const res = await onFile(teamId || null);
      const team = teams.find(x => x.id === teamId)?.name;
      toast.success(
        teamId
          ? t("leads.filedToTeam", { count: res.filed, team, defaultValue: "{{count}} record(s) filed to {{team}}." })
          : t("leads.unfiled", { count: res.filed, defaultValue: "{{count}} record(s) un-filed." }),
      );
      // "Skipped" means the caller may not edit that record — surfaced rather than silently dropped,
      // so a partial result is never mistaken for a complete one.
      // Ownership moving is worth saying out loud — a bulk action should never change who owns
      // work without the person who pressed it being told.
      if (res.reassigned && res.reassigned > 0) {
        toast.info(t("leads.filedReassigned", {
          count: res.reassigned,
          defaultValue: "{{count}} had no owner in that team and now belong to its team lead.",
        }));
      }

      if (res.skipped > 0) {
        toast.info(t("leads.filingSkipped", {
          count: res.skipped,
          defaultValue: "{{count}} skipped — you don't have permission to change them.",
        }));
      }
      onClear();
    } catch {
      // The mutation hook already surfaces the error toast.
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium">
        {t("leads.selectedCount", { count: selectedCount, defaultValue: "{{count}} selected" })}
      </span>
      <select
        value={teamId}
        onChange={e => setTeamId(e.target.value)}
        className="h-8 rounded-md border border-border bg-card px-2 text-sm"
      >
        <option value="">{t("leads.noTeamOption", { defaultValue: "No team (owner only)" })}</option>
        {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
      </select>
      <Button size="sm" className="h-8" onClick={apply} disabled={isPending}>
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : t("leads.fileToTeam", { defaultValue: "File to team" })}
      </Button>
      <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
        {t("leads.clearSelection", { defaultValue: "Clear" })}
      </Button>
      <p className="text-[11px] text-muted-foreground w-full">
        {t("leads.filingHint", {
          defaultValue: "A team lead only sees records filed to a team they lead. Anything held by someone outside that team — including unassigned records — is handed to its team lead to distribute.",
        })}
      </p>
    </div>
  );
}

/**
 * Selection state for a list: which ids are ticked, plus a header checkbox that acts on the rows
 * currently rendered. Deliberately scoped to visible rows — silently selecting rows the user cannot
 * see would make the count meaningless and the action surprising.
 */
export function useRowSelection(visibleIds: string[]) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const allVisiblePicked = visibleIds.length > 0 && visibleIds.every(id => picked.has(id));

  const toggleAllVisible = () =>
    setPicked(prev => {
      const next = new Set(prev);
      if (allVisiblePicked) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });

  return { picked, toggle, allVisiblePicked, toggleAllVisible, clear: () => setPicked(new Set()) };
}
