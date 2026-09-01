import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transactionsApi,
  type GetTransactionsParams,
} from "@/lib/pos/transactions.api";
import type {
  POSTransactionDto,
  POSTransactionSummaryDto,
  CreateSaleRequest,
  RefundRequest,
  LineItemRequest,
} from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const txnKeys = {
  all:     ["pos-transactions"] as const,
  lists:   () => [...txnKeys.all, "list"] as const,
  list:    (params: GetTransactionsParams) => [...txnKeys.lists(), params] as const,
  details: () => [...txnKeys.all, "detail"] as const,
  detail:  (id: string) => [...txnKeys.details(), id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useTransactions(params: GetTransactionsParams = {}) {
  return useQuery<PagedResult<POSTransactionSummaryDto>>({
    queryKey: txnKeys.list(params),
    queryFn:  () => transactionsApi.getAll(params),
  });
}

/**
 * Today's takings by hour and the payment-method split, aggregated in SQL.
 * A chart cannot be paged, so this exists instead of totalling a 500-row page of transactions
 * in the browser — which past 500 described a subset with nothing on screen saying so.
 */
export function usePosDashboard() {
  return useQuery({
    queryKey: [...txnKeys.all, "dashboard"],
    queryFn:  () => transactionsApi.getDashboard(),
    staleTime: 60 * 1000,
  });
}

export function useTransaction(id: string) {
  return useQuery<POSTransactionDto>({
    queryKey: txnKeys.detail(id),
    queryFn:  () => transactionsApi.getById(id),
    enabled:  !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Invalidates every stock-related cache: POS products list + Inventory module. */
function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["pos-products"] });
  qc.invalidateQueries({ queryKey: ["inventory-products"] }); // Inventory module same DB table
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSaleRequest) => transactionsApi.createSale(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: txnKeys.lists() });
      invalidateStock(qc);
      qc.setQueryData(txnKeys.detail(data.id), data);
      toast.success(`Sale ${data.transactionNumber} completed.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useVoidTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      reason,
    }: {
      transactionId: string;
      reason?: string | null;
    }) => transactionsApi.void(transactionId, { reason }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: txnKeys.lists() });
      invalidateStock(qc); // stock restored — update both POS and Inventory views
      qc.setQueryData(txnKeys.detail(data.id), data);
      toast.success("Transaction voided.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRefundTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: RefundRequest;
    }) => transactionsApi.refund(transactionId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: txnKeys.lists() });
      invalidateStock(qc); // stock restored — update both POS and Inventory views
      toast.success(`Refund ${data.transactionNumber} processed.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useHoldTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      sessionId: string;
      label: string;
      items: LineItemRequest[];
      customerId?: string | null;
    }) => transactionsApi.hold(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-sessions"] });
      toast.success("Transaction held.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecallTransaction() {
  return useMutation({
    mutationFn: (heldId: string) => transactionsApi.recall(heldId),
    onError: (err: Error) => toast.error(err.message),
  });
}
