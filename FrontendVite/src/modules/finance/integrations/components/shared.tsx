import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle, CircleDashed, PowerOff, Unplug, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationDto, IntegrationHealth, PostingStatus } from "@/lib/finance/integrations.api";

export const SELECT_CLASS =
  "h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
export const LABEL_CLASS = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export const HEALTH_META: Record<IntegrationHealth, { icon: LucideIcon; text: string; bg: string }> = {
  connected:     { icon: CheckCircle2,  text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  attention:     { icon: AlertTriangle, text: "text-red-600 dark:text-red-400",         bg: "bg-red-500/10" },
  partial:       { icon: CircleDashed,  text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10" },
  off:           { icon: PowerOff,      text: "text-muted-foreground",                  bg: "bg-muted/60" },
  not_connected: { icon: Unplug,        text: "text-muted-foreground",                  bg: "bg-muted/60" },
};

const STATUS_CLASS: Record<PostingStatus, string> = {
  pending:  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  posting:  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  posted:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed:   "bg-red-500/10 text-red-700 dark:text-red-400",
  skipped:  "bg-muted text-muted-foreground",
  reversed: "bg-muted text-muted-foreground",
};

/** Status is said in words as well as colour — colour alone is not a signal everyone can read. */
export function HealthBadge({ health }: { health: IntegrationHealth }) {
  const { t } = useTranslation("finance");
  const meta = HEALTH_META[health] ?? HEALTH_META.not_connected;
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", meta.bg, meta.text)}>
      <Icon className="w-3.5 h-3.5" />
      {t(`integrations.health.${health}`)}
    </span>
  );
}

export function StatusBadge({ status }: { status: PostingStatus }) {
  const { t } = useTranslation("finance");
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_CLASS[status] ?? STATUS_CLASS.skipped)}>
      {t(`integrations.status.${status === "posting" ? "pending" : status}`)}
    </span>
  );
}

/** Catalogue text comes from the server in English; the locale file overrides it where it has a translation. */
export function useIntegrationText() {
  const { t } = useTranslation("finance");
  return {
    name:    (i: Pick<IntegrationDto, "key" | "name">) => t(`integrations.catalog.${i.key}.name`, { defaultValue: i.name }),
    trigger: (i: Pick<IntegrationDto, "key" | "trigger">) => t(`integrations.catalog.${i.key}.trigger`, { defaultValue: i.trigger }),
    notes:   (i: Pick<IntegrationDto, "key" | "notes">) => t(`integrations.catalog.${i.key}.notes`, { defaultValue: i.notes }),
    nameOf:  (key: string, fallback: string) => t(`integrations.catalog.${key}.name`, { defaultValue: fallback }),
    role:    (role: string, fallback: string) => t(`integrations.role.${role}`, { defaultValue: fallback }),
    module:  (module: string) => t(`integrations.module.${module}`, { defaultValue: module }),
  };
}
