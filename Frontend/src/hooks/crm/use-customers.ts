import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi, type CreateCustomerRequest } from "@/lib/crm/customers.api";

export const customerKeys = {
  all:     ["crm-customers"] as const,
  list:    (params?: Record<string, string>) => [...customerKeys.all, "list", params ?? {}] as const,
  detail:  (id: string) => [...customerKeys.all, "detail", id] as const,
  summary: () => [...customerKeys.all, "summary"] as const,
};

export function useCustomers(params?: Record<string, string>) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn:  () => customersApi.getAll(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn:  () => customersApi.getById(id),
    enabled:  !!id,
  });
}

export function useCustomerSummary() {
  return useQuery({
    queryKey: customerKeys.summary(),
    queryFn:  () => customersApi.getSummary(),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerRequest) => customersApi.create(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: customerKeys.all }); },
  });
}
