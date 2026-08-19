import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Search, ShieldAlert, AlertTriangle, Activity, Calendar,
  LogIn, LogOut, FilePlus, FileEdit, Trash2, Download,
  CheckCircle, XCircle, Eye, ChevronDown, Loader2, RefreshCw,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/identity/use-audit-logs";
import type { AuditLogDto } from "@/lib/identity/types";

// ── Action display config ─────────────────────────────────────────────────────

type ActionKey = "login" | "logout" | "create" | "update" | "delete" | "export" | "approve" | "reject" | "view" | "unknown";

interface ActionConfig { labelKey: string; color: string; bg: string; icon: React.ElementType }

const ACTION_CONFIG: Record<ActionKey, ActionConfig> = {
  login:   { labelKey: "audit.action.login",   color: "text-primary",           bg: "bg-primary/10",     icon: LogIn },
  logout:  { labelKey: "audit.action.logout",  color: "text-muted-foreground",  bg: "bg-muted",           icon: LogOut },
  create:  { labelKey: "audit.action.create",  color: "text-emerald-600",       bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: FilePlus },
  update:  { labelKey: "audit.action.update",  color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950/30",     icon: FileEdit },
  delete:  { labelKey: "audit.action.delete",  color: "text-destructive",       bg: "bg-destructive/10",  icon: Trash2 },
  export:  { labelKey: "audit.action.export",  color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950/30",     icon: Download },
  approve: { labelKey: "audit.action.approve", color: "text-emerald-600",       bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle },
  reject:  { labelKey: "audit.action.reject",  color: "text-destructive",       bg: "bg-destructive/10",  icon: XCircle },
  view:    { labelKey: "audit.action.view",    color: "text-muted-foreground",  bg: "bg-muted",           icon: Eye },
  unknown: { labelKey: "audit.action.unknown", color: "text-muted-foreground",  bg: "bg-muted",           icon: Activity },
};

function getActionConfig(action: string): ActionConfig {
  const key = action.toLowerCase() as ActionKey;
  return ACTION_CONFIG[key] ?? ACTION_CONFIG.unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500", "bg-indigo-500",
];

function avatarColorFor(userId: string | null): string {
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Audit Log Row ─────────────────────────────────────────────────────────────

function AuditRow({ log, index }: { log: AuditLogDto; index: number }) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en-PK";
  const actionCfg = getActionConfig(log.action);
  const ActionIcon = actionCfg.icon;
  const avatarColor = avatarColorFor(log.userId);
  const { date, time } = formatDateTime(log.occurredOn, locale);
  const displayName = log.userName ?? t("audit.system");
  const isFailed = !log.succeeded;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.015 }}
      className={cn(
        "border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
        isFailed && "border-l-2 border-l-destructive"
      )}
    >
      {/* Timestamp */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-xs">
          <p className="font-medium">{date}</p>
          <p className="text-muted-foreground">{time}</p>
        </div>
      </td>

      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className={cn("text-white text-[10px] font-bold", avatarColor)}>
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-xs truncate whitespace-nowrap">{displayName}</p>
            {log.userId && (
              <p className="text-[10px] text-muted-foreground font-mono truncate">{log.userId.slice(0, 8)}…</p>
            )}
          </div>
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
          actionCfg.color, actionCfg.bg
        )}>
          <ActionIcon className="h-3 w-3" />
          {t(actionCfg.labelKey)}
        </span>
      </td>

      {/* Entity */}
      <td className="px-4 py-3">
        <p className="text-xs font-medium">{log.entityType}</p>
        {log.entityId && (
          <p className="text-[10px] text-muted-foreground font-mono">{log.entityId.slice(0, 12)}…</p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
          log.succeeded
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
            : "bg-destructive/10 text-destructive"
        )}>
          {log.succeeded ? t("audit.success") : t("audit.failed")}
        </span>
      </td>

      {/* IP */}
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {log.ipAddress ?? "—"}
        </span>
      </td>

      {/* Changes */}
      <td className="px-4 py-3 max-w-[200px]">
        {(log.oldValues || log.newValues) ? (
          <p className="text-[10px] text-muted-foreground line-clamp-2 font-mono">
            {log.newValues ?? log.oldValues}
          </p>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">—</span>
        )}
      </td>
    </motion.tr>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const KNOWN_ACTIONS = [
  "Login", "Logout", "Create", "Update", "Delete",
  "Export", "Approve", "Reject", "View",
];

export function AuditView() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [page,           setPage]           = React.useState(1);
  const [search,         setSearch]         = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [actionFilter,   setActionFilter]   = React.useState("");
  const [actionOpen,     setActionOpen]     = React.useState(false);
  const [fromDate,       setFromDate]       = React.useState("");
  const [toDate,         setToDate]         = React.useState("");

  // Debounce search
  React.useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    action:   actionFilter || undefined,
    from:     fromDate     || undefined,
    to:       toDate       || undefined,
  });

  const logs        = data?.items ?? [];
  const totalCount  = data?.totalCount ?? 0;
  const totalPages  = data?.totalPages ?? 1;

  // Client-side filter by username / entityType (backend may not support search)
  const filtered = React.useMemo(() => {
    if (!debouncedSearch) return logs;
    const q = debouncedSearch.toLowerCase();
    return logs.filter(l =>
      l.userName?.toLowerCase().includes(q) ||
      (l.entityType ?? "").toLowerCase().includes(q) ||
      (l.action ?? "").toLowerCase().includes(q) ||
      l.ipAddress?.toLowerCase().includes(q)
    );
  }, [logs, debouncedSearch]);

  // Stats from current page (rough; ideally backend would aggregate)
  const todayStr = todayIso();
  const todayCount = logs.filter(l => l.occurredOn.startsWith(todayStr)).length;
  const failedCount = logs.filter(l => !l.succeeded).length;

  const actionLabel = (a: string) => t(`audit.action.${a.toLowerCase()}`, { defaultValue: a });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("audit.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("audit.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-9"
          onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {tc("action.refresh")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("audit.statTotal"),  value: totalCount,   icon: Activity,      color: "bg-primary/10 text-primary" },
          { label: t("audit.statFailed"), value: failedCount,  icon: ShieldAlert,   color: "bg-destructive/10 text-destructive" },
          { label: t("audit.statToday"),  value: todayCount,   icon: Calendar,      color: "bg-muted text-muted-foreground" },
          { label: t("audit.statPage"),   value: `${page}/${totalPages}`, icon: AlertTriangle, color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("audit.searchPlaceholder")} className="pl-9" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Action dropdown */}
        <div className="relative">
          <Button variant="outline" className="gap-2 min-w-[150px]"
            onClick={() => setActionOpen(o => !o)}>
            {actionFilter ? actionLabel(actionFilter) : t("audit.allActions")}
            <ChevronDown className="h-4 w-4" />
          </Button>
          {actionOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
              <button className={cn("w-full text-left px-4 py-2 text-sm hover:bg-muted",
                !actionFilter && "bg-primary/10 text-primary")}
                onClick={() => { setActionFilter(""); setActionOpen(false); setPage(1); }}>
                {t("audit.allActions")}
              </button>
              {KNOWN_ACTIONS.map(a => (
                <button key={a}
                  className={cn("w-full text-left px-4 py-2 text-sm hover:bg-muted",
                    actionFilter === a && "bg-primary/10 text-primary")}
                  onClick={() => { setActionFilter(a); setActionOpen(false); setPage(1); }}>
                  {actionLabel(a)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Input type="date" className="h-10 text-sm w-36"
            value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
          <span className="text-muted-foreground text-sm">{t("audit.to")}</span>
          <Input type="date" className="h-10 text-sm w-36"
            value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
              {tc("action.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-4 py-2">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          {fromDate || toDate
            ? <>{t("audit.filtering")}: <strong>{fromDate || t("audit.earliest")}</strong> → <strong>{toDate || t("audit.latest")}</strong></>
            : t("audit.showingAll")
          }
        </span>
        <span className="ml-auto">
          {isLoading ? tc("message.loading") : t("audit.countSummary", { total: totalCount, shown: filtered.length })}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("audit.colTimestamp")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("audit.colUser")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("audit.colAction")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("audit.colEntity")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("audit.colStatus")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("audit.colIp")}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("audit.colChanges")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {t("audit.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => (
                  <AuditRow key={log.id} log={log} index={i} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("audit.pageOf", { page, total: totalPages, n: totalCount })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8"
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || isFetching}>
              <ChevronLeft className="h-4 w-4" />{tc("action.previous")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isFetching}>
              {tc("action.next")}<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
