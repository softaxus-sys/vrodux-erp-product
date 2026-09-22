import * as React from "react";
import { useTranslation } from "react-i18next";
import { Phone, Mail, Calendar, CheckSquare, StickyNote, Plus, Check, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useActivities, useCreateActivity, useCompleteActivity, useReopenActivity,
} from "@/hooks/crm/use-crm";
import { useAuthStore } from "@/store/auth.store";
import { useAssignableByTeam, decodeAssignee, encodeAssignee } from "@/hooks/identity/use-assignable-by-team";
import { isActivityLog, type ActivityType } from "@/lib/crm/crm.api";

const TYPES: { value: ActivityType; icon: typeof Phone }[] = [
  { value: "task", icon: CheckSquare },
  { value: "call", icon: Phone },
  { value: "meeting", icon: Calendar },
  { value: "email", icon: Mail },
  { value: "note", icon: StickyNote },
];
const ICON: Record<string, typeof Phone> = { task: CheckSquare, call: Phone, meeting: Calendar, email: Mail, note: StickyNote };

interface Props {
  relatedToType: "lead" | "deal" | "customer";
  relatedToId: string;
  relatedToName: string;
  assignedTo?: string;
  /** The record owner's login, used to preselect the assignee. */
  assignedToUserId?: string | null;
}

export function ActivityTimeline({
  relatedToType, relatedToId, relatedToName, assignedTo = "", assignedToUserId = null,
}: Props) {
  const { t } = useTranslation("crm");
  const { data: activities = [] } = useActivities({ relatedToType, relatedToId });
  const create = useCreateActivity();
  const complete = useCompleteActivity();
  const reopen = useReopenActivity();

  const currentUserName = useAuthStore(s => s.user?.name) ?? "";
  const currentUserId = useAuthStore(s => s.user?.id) ?? "";

  // The people this caller may hand CRM work to, grouped by team (server-scoped to their tier).
  const { groups } = useAssignableByTeam();

  // Preselect the record's owner so the common case — a task for whoever owns this lead — is one
  // click. Falls back to the signed-in user on an unassigned record.
  const [assignee, setAssignee] = React.useState<string>(() =>
    encodeAssignee(assignedToUserId || currentUserId, null));

  // The record's owner can change while the drawer is open (a reassign in another tab), and a picker
  // still pointing at the previous owner would quietly file the next task to the wrong person.
  React.useEffect(() => {
    setAssignee(encodeAssignee(assignedToUserId || currentUserId, null));
  }, [assignedToUserId, currentUserId]);


  const [type, setType] = React.useState<ActivityType>("note");
  const [subject, setSubject] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  const needsDue = type === "task" || type === "call" || type === "meeting";

  const add = () => {
    if (!subject.trim()) return;

    // The picker is the source of truth for WHO. The name is still sent because the backend keeps
    // AssignedTo for display and legacy rows; the id is what routes the notification, and matching
    // a person by name is exactly the guess that puts a task on the wrong list.
    const { userId } = decodeAssignee(assignee);
    const picked = groups.flatMap(g => g.members).find(m => m.id === userId);
    const ownerName = picked?.fullName || assignedTo?.trim() || currentUserName || "Unassigned";

    create.mutate({
      type, subject: subject.trim(), description: null,
      relatedToType, relatedToId, relatedToName,
      dueDate: needsDue && dueDate ? dueDate : null,
      assignedTo: ownerName,
      assignedToUserId: userId || null,
    }, { onSuccess: () => { setSubject(""); setDueDate(""); } });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Quick add */}
      <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/20">
        <div className="flex flex-wrap gap-1">
          {TYPES.map(ty => {
            const Icon = ty.icon;
            return (
              <button key={ty.value} onClick={() => setType(ty.value)}
                className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all",
                  type === ty.value ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted")}>
                <Icon className="h-3 w-3" />{t(`activityType.${ty.value}`)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input value={subject} onChange={e => setSubject(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
            placeholder={type === "note" ? t("activity.logNote") : t("activity.addA", { type: t(`activityType.${type}`) })} className="h-8 text-sm flex-1" />
          {needsDue && <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-xs w-36" />}
          <Button size="sm" className="h-8 gap-1" disabled={!subject.trim() || create.isPending} onClick={add}>
            <Plus className="h-3.5 w-3.5" />{t("activity.add")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* bg-card, not bg-transparent — a transparent select renders an OS-native white popup in
              dark mode (the project-wide rule). */}
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            aria-label={t("activity.assignTo", { defaultValue: "Assign to" })}
            className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">{t("activity.unassigned", { defaultValue: "Unassigned" })}</option>
            {groups.map(g => (
              <optgroup key={g.team} label={g.team}>
                {g.members.map(m => (
                  // Keyed by team + user: the same person appears under every team they belong to,
                  // so a user id alone is not unique here.
                  <option key={`${g.team}-${m.id}`} value={encodeAssignee(m.id, null)}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t("activity.empty")}</p>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const Icon = ICON[a.type] ?? StickyNote;
            const overdue = !a.completed && a.dueDate && a.dueDate < today;
            return (
              <div key={a.id} className={cn("flex items-start gap-2.5 rounded-lg border p-2.5 group",
                a.completed ? "border-border/50 bg-muted/20" : "border-border")}>
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  a.completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{a.subject}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{t(`activityType.${a.type}`)}</span>
                    {a.dueDate && (
                      <span className={cn("inline-flex items-center gap-0.5", overdue && "text-destructive font-semibold")}>
                        <Clock className="h-2.5 w-2.5" />{a.dueDate}{overdue && ` · ${t("activity.overdue")}`}
                      </span>
                    )}
                    {a.assignedTo && <span>· {a.assignedTo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isActivityLog(a.type) && (
                    a.completed
                      ? <button title={t("activity.reopen")} onClick={() => reopen.mutate(a.id)} className="p-1 rounded text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
                      : <button title={t("activity.complete")} onClick={() => complete.mutate(a.id)} className="p-1 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
