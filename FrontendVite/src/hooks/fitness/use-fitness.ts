import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fitnessApi } from "@/lib/fitness/fitness.api";

const QK = "fitness";

/**
 * A mutation that refreshes the listed parts of the module and tells the user what happened.
 * Everything in Fitness is cross-linked (selling a plan changes a member, a balance, the dashboard),
 * so by default it refreshes all of it — correct beats clever.
 */
export function useAct<TArgs, TRes>(fn: (a: TArgs) => Promise<TRes>, ok?: string, parts?: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (parts) parts.forEach(p => qc.invalidateQueries({ queryKey: [QK, p] }));
      else qc.invalidateQueries({ queryKey: [QK] });
      if (ok) toast.success(ok);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const useBranches = (activeOnly = false) => useQuery({ queryKey: [QK, "branches", activeOnly], queryFn: () => fitnessApi.branches(activeOnly), staleTime: 60_000 });
export const usePlans = (activeOnly = false) => useQuery({ queryKey: [QK, "plans", activeOnly], queryFn: () => fitnessApi.plans(activeOnly), staleTime: 60_000 });
export const useSettings = () => useQuery({ queryKey: [QK, "settings"], queryFn: fitnessApi.settings, staleTime: 60_000 });

export const useMembers = (q: Parameters<typeof fitnessApi.members>[0]) =>
  useQuery({ queryKey: [QK, "members", q], queryFn: () => fitnessApi.members(q), placeholderData: keepPreviousData });
export const useMember = (id: string | null) =>
  useQuery({ queryKey: [QK, "member", id], queryFn: () => fitnessApi.member(id!), enabled: !!id });
export const usePrograms = (q: { type?: string; memberId?: string; templatesOnly?: boolean }, enabled = true) =>
  useQuery({ queryKey: [QK, "programs", q], queryFn: () => fitnessApi.programs(q), enabled });
export const useMeasurements = (memberId: string | null) =>
  useQuery({ queryKey: [QK, "measurements", memberId], queryFn: () => fitnessApi.measurements(memberId!), enabled: !!memberId });
export const usePayments = (q: Parameters<typeof fitnessApi.payments>[0]) =>
  useQuery({ queryKey: [QK, "payments", q], queryFn: () => fitnessApi.payments(q), placeholderData: keepPreviousData });

export const useVisits = (q: Parameters<typeof fitnessApi.visits>[0], poll = false) =>
  useQuery({ queryKey: [QK, "visits", q], queryFn: () => fitnessApi.visits(q), refetchInterval: poll ? 20_000 : false, placeholderData: keepPreviousData });
export const useOccupancy = () => useQuery({ queryKey: [QK, "occupancy"], queryFn: fitnessApi.occupancy, refetchInterval: 20_000 });

export const useClassTypes = (activeOnly = false) => useQuery({ queryKey: [QK, "class-types", activeOnly], queryFn: () => fitnessApi.classTypes(activeOnly), staleTime: 60_000 });
export const useSessions = (q: Parameters<typeof fitnessApi.sessions>[0]) =>
  useQuery({ queryKey: [QK, "sessions", q], queryFn: () => fitnessApi.sessions(q), placeholderData: keepPreviousData });
export const useBookings = (q: Parameters<typeof fitnessApi.bookings>[0], enabled = true) =>
  useQuery({ queryKey: [QK, "bookings", q], queryFn: () => fitnessApi.bookings(q), enabled });

export const useTrainers = (activeOnly = false) => useQuery({ queryKey: [QK, "trainers", activeOnly], queryFn: () => fitnessApi.trainers(activeOnly), staleTime: 60_000 });
export const usePtPackages = (q: Parameters<typeof fitnessApi.ptPackages>[0]) => useQuery({ queryKey: [QK, "pt-packages", q], queryFn: () => fitnessApi.ptPackages(q) });
export const usePtSessions = (q: Parameters<typeof fitnessApi.ptSessions>[0]) => useQuery({ queryKey: [QK, "pt-sessions", q], queryFn: () => fitnessApi.ptSessions(q) });

export const useEquipment = (q: Parameters<typeof fitnessApi.equipment>[0]) => useQuery({ queryKey: [QK, "equipment", q], queryFn: () => fitnessApi.equipment(q) });
export const useMaintenance = (id: string | null) => useQuery({ queryKey: [QK, "maintenance", id], queryFn: () => fitnessApi.maintenance(id!), enabled: !!id });
export const useLockers = (q: Parameters<typeof fitnessApi.lockers>[0]) => useQuery({ queryKey: [QK, "lockers", q], queryFn: () => fitnessApi.lockers(q) });
export const useLeads = (q: Parameters<typeof fitnessApi.leads>[0]) => useQuery({ queryKey: [QK, "leads", q], queryFn: () => fitnessApi.leads(q) });

export const useFitnessDashboard = (branchId?: string) =>
  useQuery({ queryKey: [QK, "dashboard", branchId], queryFn: () => fitnessApi.dashboard(branchId), refetchInterval: 60_000 });

// ── Working branch ──────────────────────────────────────────────────────────

const BRANCH_KEY = "vrodux.fitness.branch";

/** The branch this desk is at. Per device: a front-desk PC belongs to one branch whoever signs in. */
export function useWorkingBranch() {
  const { data: branches = [] } = useBranches(true);
  const [stored, setStored] = React.useState<string>(() => { try { return localStorage.getItem(BRANCH_KEY) ?? ""; } catch { return ""; } });
  const current = branches.find(b => b.id === stored) ?? branches[0];
  const set = React.useCallback((id: string) => {
    setStored(id);
    try { localStorage.setItem(BRANCH_KEY, id); } catch { /* private window: fine, just not remembered */ }
  }, []);
  return { branches, branchId: current?.id ?? "", branch: current, setBranchId: set };
}
