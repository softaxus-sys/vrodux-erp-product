import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workflowApi } from "@/lib/workflow/workflow.api";

const QK = "workflow";

/** A write that refreshes the whole module — requests, queues, dashboard and audit all move together. */
export function useAct<TArgs, TRes>(fn: (a: TArgs) => Promise<TRes>, ok?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); if (ok) toast.success(ok); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useWfContext = () => useQuery({ queryKey: [QK, "context"], queryFn: workflowApi.context, staleTime: 30_000 });
export const useWfBases = () => useQuery({ queryKey: [QK, "bases"], queryFn: workflowApi.bases, staleTime: 30_000 });
export const useWfUnits = () => useQuery({ queryKey: [QK, "units"], queryFn: workflowApi.units, staleTime: 30_000 });
export const usePositions = (enabled = true) => useQuery({ queryKey: [QK, "positions"], queryFn: workflowApi.positions, enabled });
export const useHolders = (positionId?: string, enabled = true) => useQuery({ queryKey: [QK, "holders", positionId ?? null], queryFn: () => workflowApi.holders(positionId), enabled });
export const useForms = (all = false) => useQuery({ queryKey: [QK, "forms", all], queryFn: () => workflowApi.forms(all), staleTime: 30_000 });
export const useFlows = (formId?: string, enabled = true) => useQuery({ queryKey: [QK, "flows", formId ?? null], queryFn: () => workflowApi.flows(formId), enabled });
export const useStarterPack = (enabled = true) => useQuery({ queryKey: [QK, "starter"], queryFn: workflowApi.starterPack, enabled });
export const useBaseAccess = (id: string | null) => useQuery({ queryKey: [QK, "base-access", id], queryFn: () => workflowApi.baseAccess(id!), enabled: !!id });
export const useDashboard = () => useQuery({ queryKey: [QK, "dashboard"], queryFn: workflowApi.dashboard, refetchInterval: 60_000 });

export const useRequests = (q: Parameters<typeof workflowApi.requests>[0]) =>
  useQuery({ queryKey: [QK, "requests", q], queryFn: () => workflowApi.requests(q), placeholderData: keepPreviousData, refetchInterval: 45_000 });
export const useRequest = (id: string | undefined) =>
  useQuery({ queryKey: [QK, "request", id], queryFn: () => workflowApi.request(id!), enabled: !!id, refetchInterval: 30_000 });

export const useResolvedFlow = (q: { formId?: string; baseId?: string; unitId?: string | null; amount?: number }) =>
  useQuery({
    queryKey: [QK, "resolve", q],
    queryFn: () => workflowApi.resolve({ formId: q.formId!, baseId: q.baseId!, unitId: q.unitId, amount: q.amount }),
    enabled: !!q.formId && !!q.baseId,
    staleTime: 10_000,
  });

export const useEmployees = (q: Parameters<typeof workflowApi.employees>[0]) =>
  useQuery({ queryKey: [QK, "employees", q], queryFn: () => workflowApi.employees(q), placeholderData: keepPreviousData });
export const useAudit = (q: Parameters<typeof workflowApi.audit>[0]) =>
  useQuery({ queryKey: [QK, "audit", q], queryFn: () => workflowApi.audit(q), placeholderData: keepPreviousData });

export const useDocTypes = () => useQuery({ queryKey: [QK, "doctypes"], queryFn: workflowApi.docTypes, staleTime: 30_000 });
export const useCalendar = (baseId: string | null, month: string) =>
  useQuery({ queryKey: [QK, "calendar", baseId, month], queryFn: () => workflowApi.calendar(baseId!, month), enabled: !!baseId, placeholderData: keepPreviousData });
export const useRepoDocs = (q: Parameters<typeof workflowApi.repoDocs>[0], enabled = true) =>
  useQuery({ queryKey: [QK, "repodocs", q], queryFn: () => workflowApi.repoDocs(q), enabled, placeholderData: keepPreviousData });

/**
 * The Base the person is working in. Remembered per device; falls back to the first Base they may use,
 * and to nothing while the context is loading. Never returns a Base they cannot use.
 */
export function useActiveBase() {
  const { data } = useWfContext();
  const [stored, setStored] = React.useState<string | null>(() => {
    try { return localStorage.getItem("wf.base"); } catch { return null; }
  });
  const bases = data?.bases ?? [];
  const active = bases.find(b => b.id === stored) ?? bases[0] ?? null;
  const set = React.useCallback((id: string) => {
    setStored(id);
    try { localStorage.setItem("wf.base", id); } catch { /* storage may be blocked */ }
  }, []);
  return { base: active, bases, setBase: set, labels: data?.settings };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}
