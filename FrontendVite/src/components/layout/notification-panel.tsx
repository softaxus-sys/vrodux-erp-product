import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, Check, CheckCheck, Monitor, Settings2, Volume2, VolumeX, X,
} from "lucide-react";
import { useUiStore } from "@/store/ui.store";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDismissNotification, useMarkAllNotificationsRead, useMarkNotificationRead,
  useNotificationFeed, useNotificationStream, useNotificationSummary,
} from "@/hooks/notifications/use-notifications";
import { moduleMeta, typeAccent, typeIcon } from "@/lib/notifications/notification-meta";
import {
  desktopPermission, requestDesktopPermission, useNotificationPrefs,
} from "@/lib/notifications/notification-prefs";
import { playNotificationChime } from "@/lib/notifications/notification-sound";
import { showDesktopEnabledToast, showNotificationToast } from "@/components/notifications/notification-toast";
import type { NotificationDto } from "@/lib/notifications/notifications.api";

/**
 * The bell. Mounted once for the whole app (it lives in the ERP layout), which is also what makes it
 * the right place to own the realtime connection — one socket, one set of toasts.
 */
export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUiStore();
  const navigate = useNavigate();

  const feed = useNotificationFeed();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  const [moduleFilter, setModuleFilter] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);

  const items = feed.data?.items ?? [];
  const unreadCount = feed.data?.unreadCount ?? 0;

  const open = React.useCallback((n: NotificationDto) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) {
      setNotificationPanelOpen(false);
      navigate(n.link);
    }
  }, [markRead, navigate, setNotificationPanelOpen]);

  // Live push. The handler is stable-by-ref inside the hook, so this does not churn the socket.
  useNotificationStream(React.useCallback((n: NotificationDto) => {
    showNotificationToast(n, open);
  }, [open]));

  const summary = useNotificationSummary(notificationPanelOpen);

  // Chips are built from what is actually IN the feed, not from the full module list — offering a
  // filter that can only ever return nothing is worse than offering none.
  const presentModules = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items) counts.set(n.module, (counts.get(n.module) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => moduleMeta(a).label.localeCompare(moduleMeta(b).label));
  }, [items]);

  const unreadByModule = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const row of summary.data ?? []) m.set(row.module, row.count);
    return m;
  }, [summary.data]);

  const visible = moduleFilter ? items.filter(n => n.module === moduleFilter) : items;

  return (
    <AnimatePresence>
      {notificationPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setNotificationPanelOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "fixed end-4 top-20 z-50 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden",
              "rounded-2xl border border-border bg-card shadow-enterprise-lg",
            )}
          >
            <Header
              unreadCount={unreadCount}
              onReadAll={() => markAllRead.mutate()}
              onClose={() => setNotificationPanelOpen(false)}
              settingsOpen={showSettings}
              onToggleSettings={() => setShowSettings(s => !s)}
            />

            <AnimatePresence initial={false}>
              {showSettings && <SettingsPanel presentModules={presentModules} />}
            </AnimatePresence>

            {presentModules.length > 1 && (
              <FilterChips
                modules={presentModules}
                active={moduleFilter}
                unreadByModule={unreadByModule}
                onSelect={setModuleFilter}
              />
            )}

            <ScrollArea className="h-[24rem]">
              {feed.isLoading ? (
                <SkeletonRows />
              ) : visible.length === 0 ? (
                <EmptyState filtered={moduleFilter !== null} />
              ) : (
                <ul className="divide-y divide-border/50">
                  {visible.map(n => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onOpen={() => open(n)}
                      onMarkRead={() => markRead.mutate(n.id)}
                      onDismiss={() => dismiss.mutate(n.id)}
                    />
                  ))}
                </ul>
              )}
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function Header({
  unreadCount, onReadAll, onClose, settingsOpen, onToggleSettings,
}: {
  unreadCount: number; onReadAll: () => void; onClose: () => void;
  settingsOpen: boolean; onToggleSettings: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          )}
        </div>
        <span className="text-sm font-semibold">Notifications</span>
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReadAll}>
            <CheckCheck className="me-1 h-3 w-3" /> Mark all read
          </Button>
        )}
        <Button
          variant="ghost" size="icon"
          className={cn("h-7 w-7", settingsOpen && "bg-muted text-foreground")}
          onClick={onToggleSettings}
          aria-label="Notification settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Per-device settings. Deliberately inside the panel rather than buried in Settings: this is where
 * someone is standing when they decide an alert was too loud or too quiet.
 */
function SettingsPanel({ presentModules }: { presentModules: string[] }) {
  const { prefs, update, toggleModule } = useNotificationPrefs();
  const [permission, setPermission] = React.useState(desktopPermission);

  const toggleSound = () => {
    const next = !prefs.sound;
    update({ sound: next });
    // Play it on enable: the point of the toggle is the sound, so hearing it is the confirmation.
    // It also satisfies the browser's user-gesture requirement while the click is still in scope.
    if (next) playNotificationChime();
  };

  const toggleDesktop = async () => {
    if (prefs.desktop) { update({ desktop: false }); return; }

    // Asked here, inside the click, because a permission prompt raised outside a gesture is ignored
    // or auto-denied — and a denial is sticky, so getting this wrong costs the feature for good.
    const result = permission === "granted" ? "granted" : await requestDesktopPermission();
    setPermission(result);
    if (result === "granted") { update({ desktop: true }); showDesktopEnabledToast(); }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden border-b border-border bg-muted/30"
    >
      <div className="space-y-3 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          This device
        </p>

        <ToggleRow
          icon={prefs.sound ? Volume2 : VolumeX}
          label="Sound"
          hint="Play a chime when something arrives"
          checked={prefs.sound}
          onChange={toggleSound}
        />

        <ToggleRow
          icon={Monitor}
          label="Desktop alerts"
          hint={
            permission === "unsupported" ? "Not supported by this browser"
            : permission === "denied"    ? "Blocked — enable notifications for this site in your browser settings"
            : "Notify me when Vrodux is in another tab"
          }
          checked={prefs.desktop}
          disabled={permission === "unsupported" || permission === "denied"}
          onChange={toggleDesktop}
        />

        {presentModules.length > 0 && (
          <div className="pt-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mute on this device
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presentModules.map(m => {
                const meta = moduleMeta(m);
                const muted = prefs.mutedModules.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModule(m)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      muted
                        ? "border-border bg-muted text-muted-foreground line-through"
                        : "border-transparent bg-primary/10 text-primary",
                    )}
                  >
                    {muted && <BellOff className="h-3 w-3" />}
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {/* Says plainly what muting does, so nobody assumes it stops the alert being recorded. */}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Muted modules still appear in this list — only the toast, chime and desktop alert are silenced.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; hint: string; checked: boolean; onChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-1 py-1 text-start transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "start-[1.125rem]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

function FilterChips({
  modules, active, unreadByModule, onSelect,
}: {
  modules: string[]; active: string | null;
  unreadByModule: Map<string, number>; onSelect: (m: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
      <Chip label="All" active={active === null} onClick={() => onSelect(null)} />
      {modules.map(m => (
        <Chip
          key={m}
          label={moduleMeta(m).label}
          count={unreadByModule.get(m)}
          active={active === m}
          onClick={() => onSelect(active === m ? null : m)}
        />
      ))}
    </div>
  );
}

function Chip({ label, count, active, onClick }: {
  label: string; count?: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {!!count && (
        <span className={cn(
          "rounded-full px-1 text-[10px] font-bold",
          active ? "bg-primary-foreground/20" : "bg-primary/15 text-primary",
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function NotificationRow({ n, onOpen, onMarkRead, onDismiss }: {
  n: NotificationDto; onOpen: () => void; onMarkRead: () => void; onDismiss: () => void;
}) {
  const meta = moduleMeta(n.module);
  const Icon = typeIcon(n.type, n.module);

  return (
    <li className={cn("group relative transition-colors hover:bg-muted/40", !n.read && "bg-primary/[0.03]")}>
      {/* Unread is shown as an accent edge as well as a dot — colour alone is not a signal everyone
          can read, and the edge survives at a glance while scrolling. */}
      {!n.read && <span className={cn("absolute inset-y-0 start-0 w-0.5", typeAccent(n.type, n.module))} aria-hidden />}

      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="flex w-full cursor-pointer gap-3 px-4 py-3 text-start"
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {formatDate(n.createdAt, "relative")}
            </span>
          </div>

          <p className={cn("mt-0.5 text-sm leading-tight", !n.read ? "font-semibold" : "text-foreground/90")}>
            {n.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
        </div>

        {/* Revealed on hover/focus so the resting list stays calm, but always reachable by keyboard. */}
        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {!n.read && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onMarkRead(); }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mark as read"
              title="Mark as read"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-border/50">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium">{filtered ? "Nothing here" : "You are all caught up"}</p>
      <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
        {filtered
          ? "No notifications from this module yet."
          : "Assignments, approvals and new leads will show up here as they happen."}
      </p>
    </div>
  );
}
