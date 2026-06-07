import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorsApi, type GetVendorsParams, type UpsertVendorPayload } from "@/lib/pos/vendors.api";
import type { VendorDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const vendorKeys = {
  all:     ["pos-vendors"] as const,
  lists:   () => [...vendorKeys.all, "list"] as const,
  list:    (params: GetVendorsParams) => [...vendorKeys.lists(), params] as const,
  details: () => [...vendorKeys.all, "detail"] as const,
  detail:  (id: string) => [...vendorKeys.details(), id] as const,
};

export function useVendors(params: GetVendorsParams = {}) {
  return useQuery<PagedResult<VendorDto>>({
    queryKey: vendorKeys.list(params),
    queryFn:  () => vendorsApi.getAll(params),
  });
}

export function useVendor(id: string) {
  return useQuery<VendorDto>({
    queryKey: vendorKeys.detail(id),
    queryFn:  () => vendorsApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertVendorPayload) => vendorsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success("Vendor created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpsertVendorPayload) =>
      vendorsApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      qc.invalidateQueries({ queryKey: vendorKeys.detail(id) });
      toast.success("Vendor updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendorKeys.lists() });
      toast.success("Vendor deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
