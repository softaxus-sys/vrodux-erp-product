import * as React from "react";
import { useUiStore } from "@/store/ui.store";

/**
 * Collapses the sidebar while the POS sell screen is open, so the till gets the full width, and
 * puts it back exactly as it was on the way out.
 *
 * Applies to everyone on the screen, not just cashiers: whoever is standing at the till wants the
 * products and the cart, not the nav — a manager covering a shift no less than a cashier.
 *
 * `sidebarCollapsed` is persisted, so this remembers the incoming value and restores it on unmount
 * rather than overwriting a stored preference. It only *sets* the value on entry — it does not hold
 * it collapsed — so the collapse button still works if someone wants the nav back mid-shift.
 */
export function usePosFocusMode(enabled = true) {
  const setCollapsed = useUiStore(s => s.setSidebarCollapsed);

  // Read inside the effect but before the change: by cleanup time the store holds the forced value.
  const previous = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    previous.current = useUiStore.getState().sidebarCollapsed;
    setCollapsed(true);
    return () => {
      if (previous.current !== null) setCollapsed(previous.current);
      previous.current = null;
    };
  }, [enabled, setCollapsed]);
}
