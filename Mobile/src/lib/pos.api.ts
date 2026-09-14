import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  CashMovementDto,
  POSSessionDto,
  POSSessionSummaryDto,
  POSTransactionDto,
  POSTransactionSummaryDto,
  PosDashboardDto,
  TransactionsPageParams,
} from "@/types/pos";

const SESSIONS_BASE = "/api/sessions";
const TRANSACTIONS_BASE = "/api/transactions";

/** Read/visibility keys only -- `pos.transactions.void/refund/discount` and
 *  `pos.sessions.create/approve` (open/close/suspend a till) are deliberately not used anywhere
 *  on mobile, same reasoning CLAUDE.md's Module 49 used to exclude those from the AI assistant:
 *  they move cash in a physical drawer against an open shift and belong at the terminal. */
export const POS_SESSIONS_VIEW = "pos.sessions.view";
export const POS_TRANSACTIONS_VIEW = "pos.transactions.view";
export const POS_REPORTS_VIEW = "pos.reports.view";

function buildTransactionsQuery(p: TransactionsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 30));
  if (p.sessionId) qs.set("sessionId", p.sessionId);
  if (p.cashierId) qs.set("cashierId", p.cashierId);
  if (p.type) qs.set("type", p.type);
  if (p.status) qs.set("status", p.status);
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  if (p.search?.trim()) qs.set("search", p.search.trim());
  return qs.toString();
}

export const posApi = {
  getActiveSessions: (): Promise<POSSessionSummaryDto[]> => apiClient.get(`${SESSIONS_BASE}/active`),

  getSession: (id: string): Promise<POSSessionDto> => apiClient.get(`${SESSIONS_BASE}/${id}`),

  getSessionTransactions: (sessionId: string, page = 1, pageSize = 30): Promise<PagedResult<POSTransactionSummaryDto>> =>
    apiClient.get(`${SESSIONS_BASE}/${sessionId}/transactions?page=${page}&pageSize=${pageSize}`),

  getSessionCashMovements: (sessionId: string): Promise<CashMovementDto[]> =>
    apiClient.get(`${SESSIONS_BASE}/${sessionId}/cash-movements`),

  getTransactions: (params: TransactionsPageParams = {}): Promise<PagedResult<POSTransactionSummaryDto>> =>
    apiClient.get(`${TRANSACTIONS_BASE}?${buildTransactionsQuery(params)}`),

  getTransaction: (id: string): Promise<POSTransactionDto> => apiClient.get(`${TRANSACTIONS_BASE}/${id}`),

  /** The terminal's own local date + UTC offset drive "today" server-side (a Gulf-timezone
   *  tenant's "today" isn't UTC's) -- mirrors the web client's exact calculation, not a plain
   *  ISO date, so a phone in a different timezone from the tenant still gets the tenant-correct
   *  day... actually mirrors the DEVICE's own local day, same as the web client mirrors the
   *  browser's -- consistent with "today" meaning wherever this screen is being looked at from. */
  getDashboard: (): Promise<PosDashboardDto> => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const utcOffsetMinutes = -now.getTimezoneOffset();
    return apiClient.get(`${TRANSACTIONS_BASE}/dashboard?date=${date}&utcOffsetMinutes=${utcOffsetMinutes}`);
  },
};
