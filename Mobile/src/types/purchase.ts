/**
 * Trimmed mirror of PurchaseOrdersController / VendorsController's inline DTOs
 * (Softaxis.Purchase.API.Controllers -- both are pre-CQRS tech debt per CLAUDE.md Module 5p,
 * inject PurchaseDbContext directly and define their DTOs inline in the controller file).
 */
export type PurchaseOrderStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

export interface PurchaseOrderItemDto {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
}

export interface PurchaseOrderSummaryDto {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  subTotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  expectedDate?: string | null;
  receivedDate?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PurchaseOrderDto {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  notes?: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  expectedDate?: string | null;
  receivedDate?: string | null;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface VendorDto {
  id: string;
  name: string;
  code?: string | null;
  category: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  paymentTerms: string;
  currency: string;
  notes?: string | null;
  status: string;
  rating: number;
  purchaseOrderCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PurchaseOrdersPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface VendorsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};
