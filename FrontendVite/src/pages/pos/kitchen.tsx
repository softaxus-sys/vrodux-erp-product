import { KitchenDisplayView } from "@/modules/pos/kitchen/components/kitchen-display-view";
import { usePosFocusMode } from "@/hooks/pos/use-pos-focus-mode";

export default function Page() {
  // The line reads this from a distance — it gets the full width, like the tills.
  usePosFocusMode();
  return <KitchenDisplayView />;
}
