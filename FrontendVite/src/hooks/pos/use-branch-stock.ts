import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { branchStockApi, type BranchStockRowDto } from "@/lib/pos/branch-stock.api";

export function useBranchStock(search: string, branchId?: string) {
  return useQuery<BranchStockRowDto[]>({
    queryKey: ["pos-branch-stock", search, branchId ?? ""],
    queryFn:  () => branchStockApi.get(search, branchId),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
