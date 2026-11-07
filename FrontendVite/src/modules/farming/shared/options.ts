import { useAnimals, useBatches, useEnabledTypes, useFarms, useUnits } from "@/hooks/farming/use-farming";
import { farmTypeLabel, PRODUCTS } from "@/lib/farming/farming.api";

/** Select options shared by the record forms. Only live animals and active batches are offered. */
export function useFarmOptions() {
  const types = useEnabledTypes();
  const { data: farms = [] } = useFarms();
  const { data: units = [] } = useUnits();
  const { data: animals = [] } = useAnimals({ status: "active" });
  const { data: batches = [] } = useBatches({ status: "active" });
  return {
    types: types.map(t => ({ value: t.value as string, label: t.label as string })),
    farms: farms.map(f => ({ value: f.id, label: f.name })),
    units: units.filter(u => u.isActive).map(u => ({ value: u.id, label: `${u.name} (${farmTypeLabel(u.type)})` })),
    animals: animals.map(a => ({ value: a.id, label: `${a.tagNumber}${a.name ? ` — ${a.name}` : ""} (${farmTypeLabel(a.type)})` })),
    batches: batches.map(b => ({ value: b.id, label: `${b.code} (${farmTypeLabel(b.type)}, ${b.currentCount})` })),
    products: PRODUCTS.map(p => ({ value: p.value, label: p.label })),
    rawAnimals: animals, rawBatches: batches,
  };
}

/** Last 30 days, as a starting range for record lists. */
export const monthAgo = (today: string) => {
  const d = new Date(`${today}T00:00:00`); d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
