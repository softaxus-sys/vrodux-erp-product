/**
 * Deliberately read-only ("manager visibility"), not a checkout terminal -- a phone isn't a cash
 * drawer, receipt printer, or barcode scanner, and CLAUDE.md's Module 49 already excluded POS
 * sale/void/refund/session-open/close from the AI assistant for exactly that reason ("those move
 * cash in a physical drawer against an open shift and belong at the terminal"). The same
 * reasoning applies here: shift status, today's sales, and a transaction feed are genuinely
 * useful checked-on-the-go, actually taking a payment is not. Mirrors
 * FrontendVite/src/lib/pos/{sessions,transactions,reports}.api.ts's read-side DTOs.
 */
export interface POSSessionSummaryDto {
  id: string;
  registerId: string;
  status: string;
  openedAt: string;
  totalTransactions: number;
  netSales: number;
}

export interface POSSessionDto {
  id: string;
  cashierId: string;
  registerId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashVariance: number;
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  notes: string | null;
}

export interface CashMovementDto {
  id: string;
  sessionId: string;
  cashierId: string;
  type: "PayIn" | "PayOut";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface POSLineItemDto {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface POSPaymentDto {
  id: string;
  method: string;
  amount: number;
}

export interface POSTransactionSummaryDto {
  id: string;
  transactionNumber: string;
  customerName: string | null;
  type: string;
  status: string;
  totalAmount: number;
  primaryPaymentMethod: string;
  completedAt: string;
}

export interface POSTransactionDto {
  id: string;
  transactionNumber: string;
  sessionId: string;
  cashierId: string;
  customerId: string | null;
  customerName: string | null;
  type: string;
  status: string;
  originalTxnId: string | null;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  notes: string | null;
  completedAt: string;
  lineItems: POSLineItemDto[];
  payments: POSPaymentDto[];
}

export interface TransactionsPageParams {
  page?: number;
  pageSize?: number;
  sessionId?: string;
  cashierId?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface HourlySalesDto {
  hour: number;
  total: number;
  count: number;
}

export interface PaymentMethodCountDto {
  method: string;
  count: number;
  total: number;
}

/** The terminal's own local date + UTC offset drive this server-side (comment in the web client
 *  explains why -- "today" at a till is the terminal's day, not UTC's), so mobile sends the
 *  device's own local date the same way rather than a plain ISO date that could land on the
 *  wrong side of midnight for a Gulf-timezone tenant viewed from elsewhere. */
export interface PosDashboardDto {
  hourly: HourlySalesDto[];
  methods: PaymentMethodCountDto[];
  totalSales: number;
  totalTransactions: number;
}
