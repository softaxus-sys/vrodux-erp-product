import * as React from "react";
import { useTranslation } from "react-i18next";
import { Phone, Mail, Calendar, CheckSquare, StickyNote, Plus, Check, RotateCcw, Building2, DollarSign, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomerTimeline, useCreateActivity, useCompleteActivity, useReopenActivity } from "@/hooks/crm/use-crm";
import { useAuthStore } from "@/store/auth.store";
import { isActivityLog, type ActivityType } from "@/lib/crm/crm.api";
import { ActivityDueFields, ActivityLogged, ActivitySchedule, ActivityText, ActivityTextField } from "@/modules/crm/activities/components/activity-parts";
import { isTimedActivity } from "@/lib/crm/activity-format";

const TYPES: { value: ActivityType; icon: typeof Phone }[] = [
  { value: "task", icon: CheckSquare },
  { value: "call", icon: Phone },
  { value: "meeting", icon: Calendar },
  { value: "email", icon: Mail },
  { value: "note", icon: StickyNote },
];
const ICON: Record<string, typeof Phone> = { task: CheckSquare, call: Phone, meeting: Calendar, email: Mail, note: StickyNote };

const ORIGIN: Record<string, { icon: typeof Phone; cls: string }> = {
  customer: { icon: Building2,  cls: "bg-primary/10 text-primary" },
  deal:     { icon: DollarSign, cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  lead:     { icon: UserPlus,   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

interface Props {
  customerId: string;
  customerName: string;
  accountManager?: string;
}

/** Rolled-up account timeline: the account's own activities + those of its opportunities
 *  and originating lead. Quick-add logs against the account itself. */
export function AccountTimeline({ customerId, customerName, accountManager = "" }: Props) {
  const { t } = useTranslation("crm");
  const { data: activities = [], isLoading } = useCustomerTimeline(customerId);
  const create = useCreateActivity();
  const complete = useCompleteActivity();
  const reopen = useReopenActivity();

  const currentUserName = useAuthStore(s => s.user?.name) ?? "";

  const [type, setType] = React.useState<ActivityType>("note");
  const [subject, setSubject] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [dueTime, setDueTime] = React.useState("");

  const needsDue = type === "task" || type === "call" || type === "meeting";

  const add = () => {
    if (!subject.trim()) return;
    const owner = (accountManager?.trim() || currentUserName || "Unassigned");
    create.mutate({
      type, subject: subject.trim(), description: null,
      relatedToType: "customer", relatedToId: customerId, relatedToName: customerName,
      dueDate: needsDue && dueDate ? dueDate : null,
      dueTime: needsDue && dueDate && dueTime && isTimedActivity(type) ? dueTime : null, assignedTo: owner,
    }, { onSuccess: () => { setSubject(""); setDueDate(""); setDueTime(""); } });
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
        <div className="flex flex-wrap items-start gap-2">
          <ActivityTextField type={type} value={subject} onChange={setSubject} onSubmit={add}
            placeholder={type === "note" ? t("activity.logNote") : t("activity.addA", { type: t(`activityType.${type}`) })} />
          <ActivityDueFields type={type} dueDate={dueDate} dueTime={dueTime} onDate={setDueDate} onTime={setDueTime} />
          <Button size="sm" className="h-8 gap-1" disabled={!subject.trim() || create.isPending} onClick={add}>
            <Plus className="h-3.5 w-3.5" />{t("activity.add")}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t("activity.loading")}</p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t("activity.emptyAccount")}</p>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const Icon = ICON[a.type] ?? StickyNote;
            const origin = ORIGIN[a.relatedToType] ?? ORIGIN.customer;
            const OriginIcon = origin.icon;
            const overdue = !a.completed && a.dueDate && a.dueDate < today;
            return (
              <div key={a.id} className={cn("flex items-start gap-2.5 rounded-lg border p-2.5 group",
                a.completed ? "border-border/50 bg-muted/20" : "border-border")}>
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  a.completed ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <ActivityText text={a.subject} />
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium", origin.cls)}>
                      <OriginIcon className="h-2.5 w-2.5" />{t(`activity.origin.${ORIGIN[a.relatedToType] ? a.relatedToType : "customer"}`)}
                    </span>
                    {a.relatedToName && a.relatedToType !== "customer" && <span className="truncate max-w-[140px]">{a.relatedToName}</span>}
                    <span>{t(`activityType.${a.type}`)}</span>
                    <ActivitySchedule activity={a} overdue={!!overdue} />
                    {a.assignedTo && <span>· {a.assignedTo}</span>}
                  </div>
                  <ActivityLogged activity={a} />
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
