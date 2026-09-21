import * as React from "react";

/**
 * Per-device notification settings.
 *
 * <p><b>Why localStorage rather than a server row:</b> every one of these is about the machine you
 * are sitting at, not about you. Sound belongs to a device with speakers; desktop alerts depend on a
 * permission this browser granted and another has not. Syncing them would mute your office desktop
 * because you muted your laptop.</p>
 *
 * <p>Read state is the opposite and stays on the server, where it is shared across devices.</p>
 */
export interface NotificationPrefs {
  /** Play the chime on arrival. Off by default — sound is imposed, not requested. */
  sound: boolean;
  /** Show an OS notification when the tab is not focused. Requires browser permission. */
  desktop: boolean;
  /** Module keys the user does not want alerts from on this device. */
  mutedModules: string[];
}

const KEY = "vrodux.notifications.prefs";

const DEFAULTS: NotificationPrefs = { sound: false, desktop: false, mutedModules: [] };

export function readPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      sound:        parsed.sound === true,
      desktop:      parsed.desktop === true,
      // Guards against a hand-edited or half-written value turning every render into a crash.
      mutedModules: Array.isArray(parsed.mutedModules) ? parsed.mutedModules.filter(m => typeof m === "string") : [],
    };
  } catch {
    // Private windows and blocked site data both throw here rather than returning null.
    return DEFAULTS;
  }
}

function writePrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    // Same-tab listeners: the storage event only fires in OTHER tabs, so without this the panel that
    // made the change would not re-render.
    window.dispatchEvent(new CustomEvent(KEY));
  } catch {
    /* a device that cannot persist still works for this session */
  }
}

/** Live preferences, kept in step across tabs and within this one. */
export function useNotificationPrefs() {
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(readPrefs);

  React.useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    window.addEventListener(KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = React.useCallback((patch: Partial<NotificationPrefs>) => {
    const next = { ...readPrefs(), ...patch };
    writePrefs(next);
    setPrefs(next);
  }, []);

  const toggleModule = React.useCallback((module: string) => {
    const current = readPrefs();
    const muted = current.mutedModules.includes(module)
      ? current.mutedModules.filter(m => m !== module)
      : [...current.mutedModules, module];
    const next = { ...current, mutedModules: muted };
    writePrefs(next);
    setPrefs(next);
  }, []);

  return { prefs, update, toggleModule };
}

// ── Desktop notifications ───────────────────────────────────────────────────

export type DesktopPermission = "unsupported" | "default" | "granted" | "denied";

export function desktopPermission(): DesktopPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as DesktopPermission;
}

/**
 * Asks the browser for permission. Must be called from a user gesture — browsers ignore (or
 * auto-deny) a prompt raised on page load, and a denial is sticky, so asking at the wrong moment
 * costs the feature permanently. The toggle in the panel is that gesture.
 */
export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() === "unsupported") return "unsupported";
  try {
    return (await Notification.requestPermission()) as DesktopPermission;
  } catch {
    return desktopPermission();
  }
}

/**
 * Shows an OS notification. Skipped while the tab is focused — the in-app toast is already there,
 * and two alerts for one event is noise.
 */
export function showDesktopNotification(opts: { title: string; body: string; tag?: string; onClick?: () => void }): void {
  if (desktopPermission() !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      // Tagging by notification id means a re-render or a reconnect replay replaces the banner
      // instead of stacking duplicates.
      tag:  opts.tag,
      icon: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
  } catch {
    /* some browsers throw when constructing from a non-persistent context */
  }
}
