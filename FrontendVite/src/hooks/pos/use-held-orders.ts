import * as React from "react";
import { useAuthStore } from "@/store/auth.store";

/**
 * Held (parked) sales, kept across navigation and reloads.
 *
 * They used to live in plain React state inside the POS view, so walking to Inventory and back
 * unmounted the component and silently discarded every parked sale. On a till that is a customer
 * standing at the counter while their basket is re-scanned from scratch.
 *
 * localStorage rather than the offline IndexedDB: a hold is a handful of lines that must survive a
 * route change and an accidental reload, it is read and written synchronously on a keypress, and
 * it is never anyone else's business — it belongs to this browser, on this till.
 *
 * Keyed by tenant and user, like the offline catalogue, so two cashiers sharing a machine never
 * inherit each other's parked baskets.
 */
export function useHeldOrders<T>(storageSuffix = "retail") {
  const tenantId = useAuthStore(s => s.tenant?.id);
  const userId   = useAuthStore(s => s.user?.id);

  const key = React.useMemo(
    () => `vrodux.pos.held.${storageSuffix}.${tenantId ?? "no-tenant"}.${userId ?? "no-user"}`,
    [storageSuffix, tenantId, userId],
  );

  const [held, setHeld] = React.useState<T[]>(() => read<T>(key));

  // Re-read when the key changes — a different cashier signing in on the same till must not be
  // handed the previous one's holds.
  React.useEffect(() => { setHeld(read<T>(key)); }, [key]);

  React.useEffect(() => {
    try {
      if (held.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(held));
    } catch {
      // Private windows, cleared site data and storage quotas all throw here. A hold that cannot
      // be persisted still works for the rest of this session, which is what it did before.
    }
  }, [key, held]);

  return [held, setHeld] as const;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Anything that is not an array is corrupt — a half-written value, or a format from an older
    // build. Start clean rather than handing the till something it cannot render.
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
