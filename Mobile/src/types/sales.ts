/**
 * Trimmed mirror of Sales service DTOs. Orders (SalesOrdersController) are pre-CQRS tech debt
 * with inline DTOs (CLAUDE.md Module 5o); Quotations (SalesQuotationsController, Module 51) are
 * the newer, richer CQRS feature -- the mobile app only surfaces read + the safe workflow actions
 * (send/respond/convert), never the full section/item document editor.
 */
export type SalesOrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export interface SalesOrderItemDto {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
}

export interface SalesOrderSummaryDto {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  status: SalesOrderStatus;
  subTotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  expectedDate?: string | null;
  deliveredDate?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface SalesOrderDto {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  status: SalesOrderStatus;
  notes?: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  expectedDate?: string | null;
  deliveredDate?: string | null;
  items: SalesOrderItemDto[];
  createdAt: string;
  updatedAt?: string | null;
}

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface SalesOrdersPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

// ── Quotations ──────────────────────────────────────────────────────────────────────────────
export type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "converted";

export interface QuotationItemDto {
  id: string;
  sectionId?: string | null;
  productId?: string | null;
  description: string;
  unit?: string | null;
  notes?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  isOptional: boolean;
  sortOrder: number;
  lineTotal: number;
}

export interface QuotationSummaryDto {
  id: string;
  quotationNumber: string;
  title?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  status: QuotationStatus;
  currencyCode: string;
  discountPercent: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  issueDate?: string | null;
  validUntil?: string | null;
  isExpired: boolean;
  convertedOrderId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  hasShareLink: boolean;
  sentAt?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface QuotationDto {
  id: string;
  quotationNumber: string;
  title?: string | null;
  reference?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  status: QuotationStatus;
  currencyCode: string;
  issueDate?: string | null;
  validUntil?: string | null;
  isExpired: boolean;
  coverNote?: string | null;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  preparedByName?: string | null;
  discountPercent: number;
  subTotal: number;
  discountAmount: number;
  netSubTotal: number;
  taxAmount: number;
  total: number;
  optionalTotal: number;
  items: QuotationItemDto[];
  shareToken?: string | null;
  sentAt?: string | null;
  sentTo?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  respondedByName?: string | null;
  responseComment?: string | null;
  convertedOrderId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export interface QuotationsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface ConvertQuotationResultDto {
  orderId: string;
  orderNumber: string;
}
