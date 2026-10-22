import { apiClient } from "@/lib/api-client";
import type { Line } from "@/components/forms/LineItemsEditor";
import { toNumber } from "@/components/forms/FormKit";

const BASE = "/api/sales";

export const SALES_ORDERS_CREATE = "sales.orders.create";
export const SALES_QUOTATIONS_CREATE = "sales.quotations.create";

export interface SalesCustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const items = (lines: Line[]) =>
  lines.map((l, i) => ({
    productId: l.productId,
    description: l.description.trim(),
    quantity: toNumber(l.quantity),
    unitPrice: toNumber(l.unitPrice || "0"),
    discountPercent: toNumber(l.discountPercent || "0") || 0,
    taxRate: toNumber(l.taxRate || "0") || 0,
    isOptional: false,
    sortOrder: i,
  }));

export const salesWriteApi = {
  getCustomers: (search: string): Promise<SalesCustomerLite[]> =>
    apiClient.get(`${BASE}/customers?isActive=true${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),

  createOrder: (b: { customerId: string | null; customerName: string | null; notes: string | null; expectedDate: string | null; lines: Line[] }) =>
    apiClient.post<{ id: string; orderNumber: string }>(`${BASE}/orders`, {
      customerId: b.customerId, customerName: b.customerName, notes: b.notes, expectedDate: b.expectedDate,
      items: items(b.lines).map(({ isOptional, sortOrder, ...rest }) => rest),
    }),

  createQuotation: (b: { customerId: string | null; customerName: string | null; notes: string | null; validUntil: string | null; discountPercent: number; lines: Line[] }) =>
    apiClient.post<{ id: string; quotationNumber: string }>(`${BASE}/quotations`, {
      customerId: b.customerId, customerName: b.customerName, notes: b.notes, validUntil: b.validUntil,
      discountPercent: b.discountPercent, items: items(b.lines), sections: null, document: null, templateId: null,
    }),
};
