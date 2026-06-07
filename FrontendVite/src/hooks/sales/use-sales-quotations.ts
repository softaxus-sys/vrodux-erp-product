import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  salesQuotationsApi,
  type GetSalesQuotationsParams,
  type CreateSalesQuotationRequest,
  type UpdateSalesQuotationRequest,
} from "@/lib/sales/quotations.api";
import type { SalesQuotationDto, SalesQuotationSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const salesQuotationKeys = {
  all:     ["sales-quotations"] as const,
  lists:   () => [...salesQuotationKeys.all, "list"] as const,
  list:    (params: GetSalesQuotationsParams) => [...salesQuotationKeys.lists(), params] as const,
  details: () => [...salesQuotationKeys.all, "detail"] as const,
  detail:  (id: string) => [...salesQuotationKeys.details(), id] as const,
};

export function useSalesQuotations(params: GetSalesQuotationsParams = {}) {
  return useQuery<PagedResult<SalesQuotationSummaryDto>>({
    queryKey: salesQuotationKeys.list(params),
    queryFn:  () => salesQuotationsApi.getAll(params),
  });
}

export function useSalesQuotation(id: string | null) {
  return useQuery<SalesQuotationDto>({
    queryKey: salesQuotationKeys.detail(id ?? ""),
    queryFn:  () => salesQuotationsApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreateSalesQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSalesQuotationRequest) => salesQuotationsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      toast.success("Quotation created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSalesQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateSalesQuotationRequest) =>
      salesQuotationsApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      qc.invalidateQueries({ queryKey: salesQuotationKeys.detail(id) });
      toast.success("Quotation updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConvertQuotationToOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesQuotationsApi.convertToOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      toast.success("Quotation converted to sales order.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSalesQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesQuotationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      toast.success("Quotation deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
