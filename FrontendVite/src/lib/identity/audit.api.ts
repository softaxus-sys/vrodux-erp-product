import { apiClient, type PagedResult } from "@/lib/api-client";
import type { AuditLogDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/audit-logs`;

export interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  getAll: (params: GetAuditLogsParams = {}): Promise<PagedResult<AuditLogDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.userId)   qs.set("userId",   params.userId);
    if (params.action)   qs.set("action",   params.action);
    if (params.from)     qs.set("from",     params.from);
    if (params.to)       qs.set("to",       params.to);
    return apiClient.get<PagedResult<AuditLogDto>>(`${BASE}?${qs}`);
  },
};
