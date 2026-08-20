import { useQuery } from "@tanstack/react-query";
import { auditApi, type GetAuditLogsParams } from "@/lib/identity/audit.api";
import type { AuditLogDto } from "@/lib/identity/types";
import type { PagedResult } from "@/lib/api-client";

export const auditKeys = {
  all:   ["audit-logs"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list:  (params: GetAuditLogsParams) => [...auditKeys.lists(), params] as const,
};

export function useAuditLogs(params: GetAuditLogsParams = {}, enabled = true) {
  return useQuery<PagedResult<AuditLogDto>>({
    queryKey: auditKeys.list(params),
    queryFn:  () => auditApi.getAll(params),
    staleTime: 30_000,
    enabled,
  });
}
