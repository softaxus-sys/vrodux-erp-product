import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesWriteApi } from "@/lib/sales-write.api";

export function useSalesCustomers(search: string) {
  return useQuery({ queryKey: ["sales", "customers", search], queryFn: () => salesWriteApi.getCustomers(search) });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesWriteApi.createOrder, onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }) });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salesWriteApi.createQuotation, onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }) });
}
