import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { financeApi } from "@/lib/finance/finance.api";
import type { PaySetAsidesRequest, SetAsideDef, SetAsideRuleRequest } from "@/lib/finance/finance.api";
import { useAuthStore } from "@/store/auth.store";

const KEY = ["finance", "set-asides"] as const;

/** Rules are read-only to anyone who can invoice; the query is skipped for users who cannot see them. */
export function useSetAsideRules() {
  const can = useAuthStore((s) => s.hasRawPermission);
  const allowed = can("finance.invoicing.view") || can("finance.accounting.view");
  return useQuery({
    queryKey: [...KEY, "rules"],
    queryFn: () => financeApi.getSetAsideRules(),
    enabled: allowed,
    staleTime: 60_000,
  });
}

export function useSaveSetAsideRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: SetAsideRuleRequest }) =>
      id ? financeApi.updateSetAsideRule(id, data) : financeApi.createSetAsideRule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSetAsideRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.deleteSetAsideRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Rule removed. Existing invoices keep what they had."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetAsideDashboard(from?: string, to?: string) {
  return useQuery({
    queryKey: [...KEY, "dashboard", from ?? "", to ?? ""],
    queryFn: () => financeApi.getSetAsideDashboard(from, to),
    staleTime: 30_000,
  });
}

export function usePaySetAsides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PaySetAsidesRequest) => financeApi.paySetAsides(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["finance", "journals"] });
      toast.success("Payment recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Form state for an invoice's / template's set-asides.
 *
 * `initial` is what the saved document already has (undefined/null = nothing saved yet). Until the
 * user touches the box the form shows the workspace's default rules and sends NOTHING, so the server
 * applies the defaults itself — a template then keeps following rule changes. Once the user edits,
 * the list is sent explicitly (even empty = "none for this one").
 */
export function useSetAsideForm(initial: SetAsideDef[] | null | undefined) {
  const { data: rules } = useSetAsideRules();
  const defaults = React.useMemo<SetAsideDef[]>(
    () => (rules ?? []).filter(r => r.isActive && r.autoApply).map(r => ({ name: r.name, kind: r.kind, value: r.value })),
    [rules],
  );
  const [edited, setEdited] = React.useState<SetAsideDef[] | null>(null);

  // A different document (or the saved copy arriving) starts the form afresh.
  const initialKey = JSON.stringify(initial ?? null);
  React.useEffect(() => { setEdited(null); }, [initialKey]);

  const rows = edited ?? (initial ?? defaults);
  return {
    rows,
    setRows: (r: SetAsideDef[]) => setEdited(r),
    /** Forget edits — for a form that stays mounted while it is closed and re-opened. */
    reset: () => setEdited(null),
    /** Undefined = leave it to the server (workspace defaults / unchanged). */
    payload: edited ?? (initial != null ? initial : undefined),
    hasRules: (rules ?? []).length > 0,
  };
}

export function useUndoSetAsidePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.undoSetAsidePayout(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["finance", "journals"] });
      toast.success("Payment undone. The amounts are waiting to be paid again.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
