import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  CashMovementDto,
  CloseSessionRequest,
  CreateSaleRequest,
  OpenSessionRequest,
  PaymentMethodDto,
  POSSessionDto,
  POSSessionSummaryDto,
  POSTransactionDto,
  POSTransactionSummaryDto,
  PosDashboardDto,
  TransactionsPageParams,
} from "@/types/pos";

const SESSIONS_BASE = "/api/sessions";
const TRANSACTIONS_BASE = "/api/transactions";
const PAYMENT_METHODS_BASE = "/api/payment-methods";

/** Read/visibility keys. `pos.transactions.void/refund/discount` (still deliberately excluded --
 *  same reasoning CLAUDE.md's Module 49 used for the AI assistant) and the two *_CREATE keys below
 *  are the full set mobile now uses; see Mobile/README.md's "POS Checkout" section. */
export const POS_SESSIONS_VIEW = "pos.sessions.view";
export const POS_TRANSACTIONS_VIEW = "pos.transactions.view";
export const POS_REPORTS_VIEW = "pos.reports.view";
/** Open/close a shift. Gates the "Open/Close Shift" screens only -- the backend endpoints
 *  currently enforce `[Authorize]` alone (confirmed by reading SessionsController directly), but
 *  mobile still gates its own UI on the intended permission key, same as every other module here. */
export const POS_SESSIONS_CREATE = "pos.sessions.create";
/** Record a sale. Same enforcement caveat as above -- gates the "New Sale" entry point. */
export const POS_TRANSACTIONS_CREATE = "pos.transactions.create";

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

  // ── Checkout ─────────────────────────────────────────────────────────────
  openSession: (payload: OpenSessionRequest): Promise<POSSessionDto> => apiClient.post(`${SESSIONS_BASE}/open`, payload),

  closeSession: (sessionId: string, payload: CloseSessionRequest): Promise<POSSessionDto> =>
    apiClient.post(`${SESSIONS_BASE}/${sessionId}/close`, payload),

  createSale: (payload: CreateSaleRequest): Promise<POSTransactionDto> => apiClient.post(`${TRANSACTIONS_BASE}/sale`, payload),

  getPaymentMethods: (): Promise<PaymentMethodDto[]> => apiClient.get(PAYMENT_METHODS_BASE),
};
