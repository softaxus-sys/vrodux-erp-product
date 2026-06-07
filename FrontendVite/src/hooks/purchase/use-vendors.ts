import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  purchaseVendorsApi,
  type GetPurchaseVendorsParams,
  type UpsertVendorRequest,
} from "@/lib/purchase/vendors.api";
import type { VendorDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const purchaseVendorKeys = {
  all:     ["purchase-vendors"] as const,
  lists:   () => [...purchaseVendorKeys.all, "list"] as const,
  list:    (params: GetPurchaseVendorsParams) => [...purchaseVendorKeys.lists(), params] as const,
  details: () => [...purchaseVendorKeys.all, "detail"] as const,
  detail:  (id: string) => [...purchaseVendorKeys.details(), id] as const,
};

export function usePurchaseVendors(params: GetPurchaseVendorsParams = {}) {
  return useQuery<PagedResult<VendorDto>>({
    queryKey: purchaseVendorKeys.list(params),
    queryFn:  () => purchaseVendorsApi.getAll(params),
  });
}

/** Load all vendors (up to 200) for dropdowns in forms. */
export function useAllPurchaseVendors() {
  return useQuery<PagedResult<VendorDto>>({
    queryKey: [...purchaseVendorKeys.all, "all"],
    queryFn:  () => purchaseVendorsApi.getAll_unbounded(),
    staleTime: 60_000,
  });
}

export function usePurchaseVendor(id: string) {
  return useQuery<VendorDto>({
    queryKey: purchaseVendorKeys.detail(id),
    queryFn:  () => purchaseVendorsApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreatePurchaseVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertVendorRequest) => purchaseVendorsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseVendorKeys.lists() });
      toast.success("Vendor created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePurchaseVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpsertVendorRequest) =>
      purchaseVendorsApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: purchaseVendorKeys.lists() });
      qc.invalidateQueries({ queryKey: purchaseVendorKeys.detail(id) });
      toast.success("Vendor updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePurchaseVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseVendorsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseVendorKeys.lists() });
      toast.success("Vendor deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
