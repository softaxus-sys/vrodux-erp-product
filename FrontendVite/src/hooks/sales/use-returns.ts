import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { returnsApi, type CreateReturnRequest } from "@/lib/sales/returns.api";

const QK = "sales-returns";

export function useReturns() {
  return useQuery({
    queryKey: [QK],
    queryFn:  returnsApi.getAll,
    staleTime: 60_000,
  });
}

export function useReturnsSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn:  returnsApi.getSummary,
    staleTime: 60_000,
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReturnRequest) => returnsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: [QK, "summary"] });
      toast.success("Return processed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
