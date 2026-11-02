import { useAuthStore } from "@/store/auth.store";

/**
 * Crash reporting (Firebase Crashlytics). Native crashes are captured automatically once the
 * module is in the build; this adds JavaScript errors, which Crashlytics cannot see on its own.
 *
 * Every call is wrapped: Expo Go and builds without the native module simply do nothing, and a
 * reporting failure must never become a crash of its own.
 */
type Crashlytics = {
  recordError: (e: Error) => void;
  log: (m: string) => void;
  setUserId: (id: string) => Promise<null>;
  setAttributes: (a: { [k: string]: string }) => Promise<null>;
};

function load(): Crashlytics | null {
  try {
    // Required lazily so a missing native module cannot break app start.
    const mod = require("@react-native-firebase/crashlytics");
    return (mod.default ?? mod)() as Crashlytics;
  } catch {
    return null;
  }
}

let started = false;

export function startCrashReporting(): void {
  if (started) return;
  started = true;
  const crash = load();
  if (!crash) return;

  // Uncaught JS errors: report, then hand on to the previous handler so the app behaves as before.
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((error, isFatal) => {
    try {
      crash.log(isFatal ? "fatal js error" : "js error");
      crash.recordError(error instanceof Error ? error : new Error(String(error)));
    } catch {
      /* never let reporting throw */
    }
    previous?.(error, isFatal);
  });

  // Tie reports to a user and workspace -- ids only, no names or email addresses.
  const identify = () => {
    try {
      const { user, tenant } = useAuthStore.getState();
      void crash.setUserId(user?.id ?? "");
      void crash.setAttributes({ tenant_id: tenant?.id ?? "", tenant_slug: tenant?.slug ?? "" });
    } catch {
      /* ignore */
    }
  };
  identify();
  useAuthStore.subscribe(identify);
}

/** Report a handled error (something caught and shown to the user that we still want to know about). */
export function reportError(error: unknown, context?: string): void {
  try {
    const crash = load();
    if (!crash) return;
    if (context) crash.log(context);
    crash.recordError(error instanceof Error ? error : new Error(String(error)));
  } catch {
    /* ignore */
  }
}
