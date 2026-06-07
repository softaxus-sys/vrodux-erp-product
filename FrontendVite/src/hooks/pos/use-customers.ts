import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/lib/pos/customers.api";
import type { CustomerDto, CustomerSummaryDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const customerKeys = {
  all:     ["pos-customers"] as const,
  lists:   () => [...customerKeys.all, "list"] as const,
  list:    (params?: object) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail:  (id: string) => [...customerKeys.details(), id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useCustomers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  return useQuery<PagedResult<CustomerSummaryDto>>({
    queryKey: customerKeys.list(params),
    queryFn:  () => customersApi.getAll(params),
  });
}

export function useCustomer(id: string) {
  return useQuery<CustomerDto>({
    queryKey: customerKeys.detail(id),
    queryFn:  () => customersApi.getById(id),
    enabled:  !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
    }) => customersApi.create(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      qc.setQueryData(customerKeys.detail(data.id), data);
      toast.success(`Customer "${data.name}" created.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
    }) => customersApi.update(customerId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      qc.setQueryData(customerKeys.detail(customerId), data);
      toast.success("Customer updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => customersApi.delete(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success("Customer deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
