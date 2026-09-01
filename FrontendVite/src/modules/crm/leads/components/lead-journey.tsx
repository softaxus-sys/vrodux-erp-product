import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles, UserPlus, ArrowRightLeft, Flag, CheckCircle2, Phone, Mail,
  CalendarClock, StickyNote, Users,
} from "lucide-react";
import { useLeadJourney } from "@/hooks/crm/use-crm";
import type { LeadJourneyEntryDto } from "@/lib/crm/crm.api";
import { formatDate, cn } from "@/lib/utils";

/**
 * The lead's whole story in one column — where it came from, every handoff and who made it, every
 * status change and how long the lead sat at the previous one, everything logged against it, and
 * its conversion.
 *
 * Read-only by design. Each entry is already editable where it lives (the activity tab, the reassign
 * dialog); a second place to change them would be a second place for them to disagree.
 */
export function LeadJourney({ leadId }: { leadId: string | null }) {
  const { t } = useTranslation("crm");
  const { data: entries, isLoading, isError, error, refetch } = useLeadJourney(leadId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("journey.loading")}</p>;
  }

  // A failed request must never look like an empty history — an owner would read "nothing happened".
  if (isError) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-sm font-medium">{t("journey.error")}</p>
        <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="text-xs font-semibold text-primary hover:underline">
          {t("journey.retry")}
        </button>
      </div>
    );
  }

  if (!entries?.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("journey.empty")}</p>;
  }

  return (
    <div className="relative">
      {/* The spine. Inset to sit under the icon centres, and RTL-safe. */}
      <div className="absolute top-2 bottom-2 start-[15px] w-px bg-border" aria-hidden />
      <ol className="space-y-4">
        {entries.map(e => <JourneyRow key={`${e.kind}-${e.id}-${e.at}`} entry={e} />)}
      </ol>
    </div>
  );
}

function JourneyRow({ entry: e }: { entry: LeadJourneyEntryDto }) {
  const { t } = useTranslation("crm");
  const { Icon, tone } = visual(e);

  return (
    <li className="relative flex gap-3">
      <div className={cn(
        "relative z-10 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ring-4 ring-background",
        tone,
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{headline(e, t)}</p>
          <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
            {formatDate(e.at, "medium")}
          </span>
        </div>

        {/* Who did it. Automated intake has no actor, so this is simply absent rather than "System". */}
        {e.actorName && (
          <p className="text-xs text-muted-foreground mt-0.5">{t("drawer.by", { name: e.actorName })}</p>
        )}

        {e.kind === "status" && e.daysInPrevious != null && e.fromValue && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("journey.dwell", {
              count: e.daysInPrevious,
              status: t(`status.${e.fromValue}`, { defaultValue: e.fromValue }),
            })}
          </p>
        )}

        {e.detail && <p className="text-xs mt-1 leading-relaxed break-words">{e.detail}</p>}
      </div>
    </li>
  );
}

/** Activity types carry their own icon; everything else is keyed off the entry kind. */
function visual(e: LeadJourneyEntryDto): { Icon: typeof Sparkles; tone: string } {
  switch (e.kind) {
    case "created":   return { Icon: Sparkles, tone: "bg-primary/10 text-primary" };
    case "assigned":  return {
      Icon: e.fromValue ? ArrowRightLeft : UserPlus,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    };
    case "status":    return { Icon: Flag, tone: "bg-warning/10 text-warning" };
    case "converted": return { Icon: CheckCircle2, tone: "bg-success/10 text-success" };
    case "activity":  return {
      Icon: e.toValue === "call"    ? Phone
          : e.toValue === "email"   ? Mail
          : e.toValue === "meeting" ? Users
          : e.toValue === "task"    ? CalendarClock
          : StickyNote,
      tone: "bg-muted text-muted-foreground",
    };
    default:          return { Icon: StickyNote, tone: "bg-muted text-muted-foreground" };
  }
}

function headline(e: LeadJourneyEntryDto, t: (k: string, o?: Record<string, unknown>) => string): string {
  const status = (v?: string | null) => v ? t(`status.${v}`, { defaultValue: v }) : "";

  switch (e.kind) {
    case "created":
      return e.detail
        ? t("journey.createdFrom", { source: t(`source.${e.detail}`, { defaultValue: e.detail }) })
        : t("journey.created");

    case "assigned":
      // A first assignment reads differently from a handoff, and conflating them loses the trail.
      return e.fromValue
        ? t("journey.reassigned", { from: e.fromValue, to: e.toValue || t("drawer.unassigned") })
        : t("journey.assigned",   { to: e.toValue || t("drawer.unassigned") });

    case "status":
      return e.fromValue
        ? t("journey.statusChanged", { from: status(e.fromValue), to: status(e.toValue) })
        : t("journey.statusSet",     { to: status(e.toValue) });

    case "activity":
      return e.completed
        ? t("journey.activityDone", { subject: e.title })
        : t("journey.activity",     { subject: e.title });

    case "converted":
      return t("journey.converted");

    default:
      return e.title ?? "";
  }
}
