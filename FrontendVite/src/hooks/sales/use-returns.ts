import { useQuery } from "@tanstack/react-query";
import { returnsApi } from "@/lib/sales/returns.api";

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
