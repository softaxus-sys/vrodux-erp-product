import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { posApi } from "@/lib/pos.api";
import type { CloseSessionRequest, CreateSaleRequest, OpenSessionRequest, TransactionsPageParams } from "@/types/pos";

const QK = "pos" as const;

export function useActiveSessions() {
  return useQuery({
    queryKey: [QK, "active-sessions"],
    queryFn: posApi.getActiveSessions,
    refetchInterval: 60_000, // shift status is worth keeping fresh without a manual pull-to-refresh
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: [QK, "session", id],
    queryFn: () => posApi.getSession(id),
    enabled: Boolean(id),
  });
}

export function useSessionTransactions(sessionId: string, page = 1, pageSize = 30) {
  return useQuery({
    queryKey: [QK, "session-transactions", sessionId, page, pageSize],
    queryFn: () => posApi.getSessionTransactions(sessionId, page, pageSize),
    enabled: Boolean(sessionId),
  });
}

export function useSessionCashMovements(sessionId: string) {
  return useQuery({
    queryKey: [QK, "cash-movements", sessionId],
    queryFn: () => posApi.getSessionCashMovements(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function useTransactions(params: TransactionsPageParams) {
  return useQuery({
    queryKey: [QK, "transactions", params],
    queryFn: () => posApi.getTransactions(params),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: [QK, "transaction", id],
    queryFn: () => posApi.getTransaction(id),
    enabled: Boolean(id),
  });
}

export function usePosDashboard(enabled = true) {
  return useQuery({
    queryKey: [QK, "dashboard"],
    queryFn: posApi.getDashboard,
    refetchInterval: 60_000,
    enabled,
  });
}

// ── Checkout ─────────────────────────────────────────────────────────────

export function useOpenSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenSessionRequest) => posApi.openSession(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "active-sessions"] }),
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: CloseSessionRequest }) =>
      posApi.closeSession(sessionId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "active-sessions"] }),
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaleRequest) => posApi.createSale(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "active-sessions"] });
      qc.invalidateQueries({ queryKey: [QK, "transactions"] });
      qc.invalidateQueries({ queryKey: [QK, "dashboard"] });
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: [QK, "payment-methods"],
    queryFn: posApi.getPaymentMethods,
  });
}
