import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/sales.api";
import type { QuotationsPageParams, SalesOrdersPageParams } from "@/types/sales";

const QK = "sales" as const;

// ── Orders ────────────────────────────────────────────────────────────────────────────────────
export function useSalesOrdersPaged(params: SalesOrdersPageParams) {
  return useQuery({
    queryKey: [QK, "orders", "paged", params],
    queryFn: () => salesApi.getOrders(params),
  });
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: [QK, "order", id],
    queryFn: () => salesApi.getOrder(id),
    enabled: Boolean(id),
  });
}

export function useSetSalesOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesApi.setOrderStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "order", id] });
      qc.invalidateQueries({ queryKey: [QK, "orders", "paged"] });
    },
  });
}

// ── Quotations ───────────────────────────────────────────────────────────────────────────────
export function useQuotationsPaged(params: QuotationsPageParams) {
  return useQuery({
    queryKey: [QK, "quotations", "paged", params],
    queryFn: () => salesApi.getQuotations(params),
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: [QK, "quotation", id],
    queryFn: () => salesApi.getQuotation(id),
    enabled: Boolean(id),
  });
}

export function useSendQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, toEmail }: { id: string; toEmail?: string }) => salesApi.sendQuotation(id, toEmail),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "quotation", id] });
      qc.invalidateQueries({ queryKey: [QK, "quotations", "paged"] });
    },
  });
}

export function useRespondToQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accepted, byName, comment }: { id: string; accepted: boolean; byName: string; comment?: string }) =>
      salesApi.respondToQuotation(id, accepted, byName, comment),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "quotation", id] });
      qc.invalidateQueries({ queryKey: [QK, "quotations", "paged"] });
    },
  });
}

export function useConvertQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.convertQuotation(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "quotation", id] });
      qc.invalidateQueries({ queryKey: [QK, "quotations", "paged"] });
      // The new sales order should show up next time the orders list is opened.
      qc.invalidateQueries({ queryKey: [QK, "orders", "paged"] });
    },
  });
}
