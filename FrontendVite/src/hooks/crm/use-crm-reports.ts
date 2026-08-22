import { useQuery } from "@tanstack/react-query";
import { crmReportsApi, type ReportFilter } from "@/lib/crm/reports.api";

const QK = "crm-reports";

// Reports are aggregates over data that changes through the day; 2 min keeps them responsive to a
// filter change without re-querying on every tab switch.
const STALE = 2 * 60 * 1000;

/** Stable cache key for a filter — undefined/empty fields must not produce distinct keys. */
function key(filter: ReportFilter) {
  return {
    from:        filter.from        || null,
    to:          filter.to          || null,
    ownerUserId: filter.ownerUserId || null,
    source:      filter.source      || null,
    stage:       filter.stage       || null,
    customerId:  filter.customerId  || null,
  };
}

export function usePipelineReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "pipeline", key(filter)],
    queryFn:  () => crmReportsApi.pipeline(filter),
    staleTime: STALE, enabled,
  });
}

export function useWinLossReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "win-loss", key(filter)],
    queryFn:  () => crmReportsApi.winLoss(filter),
    staleTime: STALE, enabled,
  });
}

export function usePerformanceReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "performance", key(filter)],
    queryFn:  () => crmReportsApi.performance(filter),
    staleTime: STALE, enabled,
  });
}

export function useLeadSourceReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "lead-sources", key(filter)],
    queryFn:  () => crmReportsApi.leadSources(filter),
    staleTime: STALE, enabled,
  });
}

export function useConversionReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "conversion", key(filter)],
    queryFn:  () => crmReportsApi.conversion(filter),
    staleTime: STALE, enabled,
  });
}

export function useVelocityReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "velocity", key(filter)],
    queryFn:  () => crmReportsApi.velocity(filter),
    staleTime: STALE, enabled,
  });
}

export function useActivityReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "activities", key(filter)],
    queryFn:  () => crmReportsApi.activities(filter),
    staleTime: STALE, enabled,
  });
}

export function useAccountRevenueReport(filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "accounts", key(filter)],
    queryFn:  () => crmReportsApi.accounts(filter),
    staleTime: STALE, enabled,
  });
}
