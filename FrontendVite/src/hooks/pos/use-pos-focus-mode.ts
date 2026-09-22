import * as React from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";

/**
 * True when the signed-in user is a till operator rather than someone who also administers POS.
 *
 * Deliberately NOT `user.role === "cashier"`: the auth store maps the backend "Cashier" and
 * "Supervisor" roles to the frontend role `"custom"` (so ROLE_DEFAULTS cannot widen their module
 * access), which means that comparison is never true. The original name survives on `roleName`.
 *
 * The permission shape is checked as well as the name, because a tenant is free to rename the role
 * — "Till Operator", "Front Desk" — and the intent is "this person only rings up sales". It mirrors
 * the seeded Cashier tier exactly: can take a sale, cannot approve a shift.
 */
export function useIsTillOperator(): boolean {
  const roleName = useAuthStore(s => s.user?.roleName);
  const has = useAuthStore(s => s.hasRawPermission);

  return React.useMemo(() => {
    if (roleName && /cashier|till/i.test(roleName)) return true;
    return has("pos.transactions.create") && !has("pos.sessions.approve");
  }, [roleName, has]);
}

/**
 * Collapses the sidebar while a till operator is on the POS, so the sell screen gets the full
 * width, and puts it back exactly as they left it on the way out.
 *
 * `sidebarCollapsed` is persisted, so this remembers the incoming value in a ref and restores it on
 * unmount rather than overwriting a stored preference. It only *sets* the value on entry — it does
 * not hold it collapsed — so the collapse button still works if the operator wants the nav back.
 */
export function usePosFocusMode(enabled = true) {
  const isTillOperator = useIsTillOperator();
  const setCollapsed   = useUiStore(s => s.setSidebarCollapsed);
  const active         = enabled && isTillOperator;

  // Read once, outside the effect: by cleanup time the store holds the forced value, not theirs.
  const previous = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!active) return;
    previous.current = useUiStore.getState().sidebarCollapsed;
    setCollapsed(true);
    return () => {
      if (previous.current !== null) setCollapsed(previous.current);
      previous.current = null;
    };
  }, [active, setCollapsed]);
}
