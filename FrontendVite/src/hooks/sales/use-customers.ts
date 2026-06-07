import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesCustomersApi, type UpsertCustomerRequest } from "@/lib/sales/customers.api";
import type { SalesCustomerDto } from "@/lib/sales/types";
import { toast } from "sonner";

export const salesCustomerKeys = {
  all:     ["sales-customers"] as const,
  lists:   () => [...salesCustomerKeys.all, "list"] as const,
  list:    (params?: object) => [...salesCustomerKeys.lists(), params] as const,
  details: () => [...salesCustomerKeys.all, "detail"] as const,
  detail:  (id: string) => [...salesCustomerKeys.details(), id] as const,
};

export function useSalesCustomers(params?: { search?: string; isActive?: boolean }) {
  return useQuery<SalesCustomerDto[]>({
    queryKey: salesCustomerKeys.list(params),
    queryFn:  () => salesCustomersApi.getAll(params),
  });
}

export function useSalesCustomer(id: string) {
  return useQuery<SalesCustomerDto>({
    queryKey: salesCustomerKeys.detail(id),
    queryFn:  () => salesCustomersApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateSalesCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertCustomerRequest) => salesCustomersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesCustomerKeys.lists() });
      toast.success("Customer created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSalesCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpsertCustomerRequest) =>
      salesCustomersApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: salesCustomerKeys.lists() });
      qc.invalidateQueries({ queryKey: salesCustomerKeys.detail(id) });
      toast.success("Customer updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSalesCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesCustomersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesCustomerKeys.lists() });
      toast.success("Customer deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
