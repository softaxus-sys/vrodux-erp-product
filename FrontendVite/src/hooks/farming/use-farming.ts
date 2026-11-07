import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { farmingApi, FARM_TYPES } from "@/lib/farming/farming.api";
import { ft } from "@/lib/farming/ft";

const QK = "farming";

/** A write that refreshes the whole module (records are cross-linked: a sale changes a batch, the dashboard…). */
export function useAct<TArgs, TRes>(fn: (a: TArgs) => Promise<TRes>, ok?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); if (ok) toast.success(ft(ok)); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useFarmSettings = () => useQuery({ queryKey: [QK, "settings"], queryFn: farmingApi.settings, staleTime: 60_000 });
/** The farm types this workspace has switched on, in catalogue order. All while loading. */
export function useEnabledTypes() {
  const { data } = useFarmSettings();
  const on = data?.enabledTypes;
  return FARM_TYPES.filter(t => !on || on.includes(t.value));
}
export const useFarms = () => useQuery({ queryKey: [QK, "farms"], queryFn: farmingApi.farms, staleTime: 60_000 });
export const useUnits = (q: Parameters<typeof farmingApi.units>[0] = {}) => useQuery({ queryKey: [QK, "units", q], queryFn: () => farmingApi.units(q), staleTime: 30_000 });
export const useFarmDashboard = () => useQuery({ queryKey: [QK, "dashboard"], queryFn: farmingApi.dashboard, refetchInterval: 60_000 });

export const useAnimals = (q: Parameters<typeof farmingApi.animals>[0] = {}) => useQuery({ queryKey: [QK, "animals", q], queryFn: () => farmingApi.animals(q), placeholderData: keepPreviousData });
export const useAnimal = (id: string | null) => useQuery({ queryKey: [QK, "animal", id], queryFn: () => farmingApi.animal(id!), enabled: !!id });
export const useBatches = (q: Parameters<typeof farmingApi.batches>[0] = {}) => useQuery({ queryKey: [QK, "batches", q], queryFn: () => farmingApi.batches(q), placeholderData: keepPreviousData });
export const useBreeding = (q: Parameters<typeof farmingApi.breeding>[0] = {}) => useQuery({ queryKey: [QK, "breeding", q], queryFn: () => farmingApi.breeding(q) });

export const useProduction = (q: Parameters<typeof farmingApi.production>[0]) => useQuery({ queryKey: [QK, "production", q], queryFn: () => farmingApi.production(q), placeholderData: keepPreviousData });
export const useFeed = (q: Parameters<typeof farmingApi.feed>[0]) => useQuery({ queryKey: [QK, "feed", q], queryFn: () => farmingApi.feed(q), placeholderData: keepPreviousData });
export const useHealth = (q: Parameters<typeof farmingApi.health>[0]) => useQuery({ queryKey: [QK, "health", q], queryFn: () => farmingApi.health(q), placeholderData: keepPreviousData });
export const useMortality = (q: Parameters<typeof farmingApi.mortality>[0]) => useQuery({ queryKey: [QK, "mortality", q], queryFn: () => farmingApi.mortality(q), placeholderData: keepPreviousData });
export const useSales = (q: Parameters<typeof farmingApi.sales>[0]) => useQuery({ queryKey: [QK, "sales", q], queryFn: () => farmingApi.sales(q), placeholderData: keepPreviousData });
export const useExpenses = (q: Parameters<typeof farmingApi.expenses>[0]) => useQuery({ queryKey: [QK, "expenses", q], queryFn: () => farmingApi.expenses(q), placeholderData: keepPreviousData });
