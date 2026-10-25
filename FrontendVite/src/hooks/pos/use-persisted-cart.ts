import * as React from "react";
import { useAuthStore } from "@/store/auth.store";

/**
 * The basket being rung up, kept across navigation and reloads.
 *
 * Like held sales (use-held-orders.ts), the current cart lived in plain React state in the POS view, so
 * visiting another menu and coming back unmounted the view and threw the customer's basket away. Stored in
 * localStorage, keyed by tenant and user so two cashiers on one till never see each other's basket; an empty
 * cart removes the entry, so a finished sale leaves nothing behind.
 */
export function usePersistedCart<T>(suffix: string): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const tenantId = useAuthStore(s => s.tenant?.id);
  const userId   = useAuthStore(s => s.user?.id);
  const key = React.useMemo(
    () => `vrodux.pos.cart.${suffix}.${tenantId ?? "no-tenant"}.${userId ?? "no-user"}`,
    [suffix, tenantId, userId],
  );

  const [cart, setCart] = React.useState<T[]>(() => read<T>(key));
  React.useEffect(() => { setCart(read<T>(key)); }, [key]);

  React.useEffect(() => {
    try {
      if (cart.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(cart));
    } catch { /* storage unavailable: the cart still works for this session */ }
  }, [cart, key]);

  return [cart, setCart];
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
