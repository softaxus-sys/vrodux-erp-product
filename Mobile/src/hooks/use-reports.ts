import { useMutation } from "@tanstack/react-query";
import { reportsApi, type ReportRunParams } from "@/lib/reports.api";
import type { ReportCategory } from "@/types/reports";

/** A report run is on-demand (the user picks filters, then taps Run), so a mutation fits better
 *  than a query keyed by filter state -- there's no "keep this fresh in the background" need. */
export function useRunReport() {
  return useMutation({
    mutationFn: ({ category, reportId, params }: { category: ReportCategory; reportId: string; params: ReportRunParams }) =>
      category === "POS" ? reportsApi.runPos(reportId, params) : reportsApi.runInventory(reportId, params),
  });
}
