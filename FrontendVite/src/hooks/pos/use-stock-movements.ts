import { useQuery } from "@tanstack/react-query";
import { stockMovementsApi, type GetStockMovementsParams } from "@/lib/pos/stock-movements.api";
import type { StockMovementDto } from "@/lib/pos/types";
import type { PagedResult } from "@/lib/api-client";

export const stockMovementKeys = {
  all:   ["pos-stock-movements"] as const,
  lists: () => [...stockMovementKeys.all, "list"] as const,
  list:  (params: GetStockMovementsParams) => [...stockMovementKeys.lists(), params] as const,
};

export function useStockMovements(params: GetStockMovementsParams = {}) {
  return useQuery<PagedResult<StockMovementDto>>({
    queryKey: stockMovementKeys.list(params),
    queryFn:  () => stockMovementsApi.getAll(params),
  });
}
