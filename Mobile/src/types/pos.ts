/**
 * Was deliberately read-only ("manager visibility") until the mobile checkout feature below --
 * see Mobile/README.md's "POS Checkout" section for the reasoning that changed (camera-as-scanner,
 * no cash drawer required) and what's still deliberately excluded (split-tender, discounts,
 * printed receipts, void/refund, hold/recall). Read-side DTOs below still mirror
 * FrontendVite/src/lib/pos/{sessions,transactions,reports}.api.ts's own shapes.
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

// ── Checkout (write side) ────────────────────────────────────────────────────

export interface OpenSessionRequest {
  registerId: string;
  openingCash: number;
}

export interface CloseSessionRequest {
  closingCash: number;
  notes?: string | null;
}

export interface CreateSaleLineItemRequest {
  productId: string;
  quantity: number;
}

export interface CreateSalePaymentRequest {
  method: string;
  amount: number;
}

export interface CreateSaleRequest {
  sessionId: string;
  lineItems: CreateSaleLineItemRequest[];
  payments: CreateSalePaymentRequest[];
  notes?: string | null;
}

/** Field names mirror the backend's PaymentMethodConfigDto exactly. `isEnabled`/`sortOrder` drive
 *  which methods the checkout picker offers and in what order -- tenant-configurable, not
 *  hardcoded, same as the web checkout's payment grid. */
export interface PaymentMethodDto {
  id: string;
  code: string;
  label: string;
  iconKey: string;
  countries: string;
  description: string | null;
  sortOrder: number;
  isEnabled: boolean;
  isSystem: boolean;
}

/** A line actually in the cart -- resolved from a barcode scan via inventoryApi.getProductByBarcode
 *  (not a POS-side type; kept local to the cart-building screen). */
export interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}
