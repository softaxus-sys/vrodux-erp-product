import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lowStockApi, type LowStockReportDto } from "@/lib/pos/low-stock.api";

export function useLowStockReport(salesDays: number) {
  return useQuery<LowStockReportDto>({
    queryKey: ["pos-low-stock", salesDays],
    queryFn:  () => lowStockApi.getReport(salesDays),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
