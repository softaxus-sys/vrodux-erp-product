import { useQuery } from "@tanstack/react-query";
import { auditApi, type GetAuditLogsParams } from "@/lib/identity/audit.api";
import type { AuditLogDto, AuditLogSummaryDto } from "@/lib/identity/types";
import type { PagedResult } from "@/lib/api-client";

export const auditKeys = {
  all:      ["audit-logs"] as const,
  lists:    () => [...auditKeys.all, "list"] as const,
  list:     (params: GetAuditLogsParams) => [...auditKeys.lists(), params] as const,
  summaries:() => [...auditKeys.all, "summary"] as const,
  summary:  (params: GetAuditLogsParams) => [...auditKeys.summaries(), params] as const,
};

export function useAuditLogs(params: GetAuditLogsParams = {}, enabled = true) {
  return useQuery<PagedResult<AuditLogDto>>({
    queryKey: auditKeys.list(params),
    queryFn:  () => auditApi.getAll(params),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Stat counts over the whole filtered set. Deliberately separate from the list query: the tiles
 * must reflect every matching row, not the 25 that happen to be on screen.
 *
 * Keyed WITHOUT page/pageSize so paging through results doesn't refetch counts that cannot change.
 */
export function useAuditLogSummary(params: GetAuditLogsParams = {}, enabled = true) {
  const { page: _page, pageSize: _pageSize, ...filters } = params;
  void _page; void _pageSize;
  return useQuery<AuditLogSummaryDto>({
    queryKey: auditKeys.summary(filters),
    queryFn:  () => auditApi.getSummary(filters),
    staleTime: 30_000,
    enabled,
  });
}
