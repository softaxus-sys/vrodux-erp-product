import { apiClient, type PagedResult } from "@/lib/api-client";
import type { AuditLogDto, AuditLogSummaryDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/audit-logs`;

export interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  /** Start day on the VIEWER's calendar (yyyy-MM-dd). */
  from?: string;
  /** End day on the viewer's calendar (yyyy-MM-dd) — the whole day is included. */
  to?: string;
  /** Free-text over action / entity type / IP / username. Applied server-side, across all pages. */
  search?: string;
}

/**
 * The viewer's UTC offset in minutes (e.g. +240 for GST, +300 for PKT).
 *
 * `getTimezoneOffset()` returns the inverse sign of what everyone means by "UTC+4", so it is
 * negated here once, at the boundary, rather than in each caller.
 */
function tzOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function buildQuery(params: GetAuditLogsParams, includePaging: boolean): URLSearchParams {
  const qs = new URLSearchParams();
  if (includePaging && params.page)     qs.set("page",     String(params.page));
  if (includePaging && params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.userId) qs.set("userId", params.userId);
  if (params.action) qs.set("action", params.action);
  if (params.from)   qs.set("from",   params.from);
  if (params.to)     qs.set("to",     params.to);
  if (params.search) qs.set("search", params.search);
  // Sent on every request: the server needs it to resolve the date filters and "today" against
  // the viewer's calendar rather than its own.
  qs.set("tzOffsetMinutes", String(tzOffsetMinutes()));
  return qs;
}

export const auditApi = {
  getAll: (params: GetAuditLogsParams = {}): Promise<PagedResult<AuditLogDto>> =>
    apiClient.get<PagedResult<AuditLogDto>>(`${BASE}?${buildQuery(params, true)}`),

  getSummary: (params: GetAuditLogsParams = {}): Promise<AuditLogSummaryDto> =>
    apiClient.get<AuditLogSummaryDto>(`${BASE}/summary?${buildQuery(params, false)}`),
};
