import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  invoicesApi,
  type GetInvoicesParams,
  type CreateInvoiceRequest,
  type UpdateInvoiceRequest,
} from "@/lib/finance/invoices.api";
import { toast } from "sonner";

export const invoiceKeys = {
  all:    ["finance-invoices"] as const,
  lists:  () => [...invoiceKeys.all, "list"] as const,
  list:   (params: GetInvoicesParams) => [...invoiceKeys.lists(), params] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};

export function useInvoices(params: GetInvoicesParams = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn:  () => invoicesApi.getAll(params),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn:  () => invoicesApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => invoicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success("Invoice created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateInvoiceRequest) =>
      invoicesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success("Invoice updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.markPaid(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success("Invoice marked as paid.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success("Invoice cancelled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success("Invoice deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
