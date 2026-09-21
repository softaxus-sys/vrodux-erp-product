import { toast } from "sonner";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { moduleMeta, typeAccent, typeIcon } from "@/lib/notifications/notification-meta";
import type { NotificationDto } from "@/lib/notifications/notifications.api";

/**
 * The arrival toast.
 *
 * <p>Built as a custom sonner toast rather than `toast(title, { description })` because the default
 * gives no room for the module identity — and across fourteen modules "which part of the system is
 * this from" is the first thing a reader needs. The accent bar and icon chip answer that before the
 * text is read.</p>
 *
 * <p>Ten seconds, not the app-wide four: this is the only chance to act on it without opening the
 * panel, and four seconds is not enough to read a title, a message and decide.</p>
 */
export function showNotificationToast(n: NotificationDto, onOpen: (n: NotificationDto) => void) {
  const meta = moduleMeta(n.module);
  const Icon = typeIcon(n.type, n.module);
  const accent = typeAccent(n.type, n.module);

  toast.custom((id) => (
    <div
      role="alert"
      className={cn(
        "relative flex w-full max-w-sm gap-3 overflow-hidden rounded-xl border border-border",
        "bg-card p-3.5 shadow-enterprise-lg ring-1 ring-black/[0.03] dark:ring-white/[0.04]",
      )}
    >
      {/* Colour-codes the module at a glance, without spending horizontal space on a label. */}
      <span className={cn("absolute inset-y-0 start-0 w-1", accent)} aria-hidden />

      <div className={cn("ms-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tone)}>
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {meta.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{n.title}</p>
        {/* Clamped: a long enquiry message must not push a toast to half the screen. */}
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>

        <div className="mt-2 flex items-center gap-3">
          {n.link && (
            <button
              type="button"
              onClick={() => { onOpen(n); toast.dismiss(id); }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open
            </button>
          )}
          <button
            type="button"
            onClick={() => toast.dismiss(id)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  ), { duration: 10_000 });
}

/** Shown once when a device turns on desktop alerts, so the user sees what they will look like. */
export function showDesktopEnabledToast() {
  toast.custom(() => (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-enterprise-lg">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <Bell className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Desktop alerts on</p>
        <p className="text-xs text-muted-foreground">
          You will be notified on this device even when Vrodux is in another tab.
        </p>
      </div>
    </div>
  ), { duration: 6_000 });
}
