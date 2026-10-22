import { apiClient } from "@/lib/api-client";
import type { Line } from "@/components/forms/LineItemsEditor";
import { toNumber } from "@/components/forms/FormKit";

const BASE = "/api/purchase";

export const PURCHASE_ORDERS_CREATE = "purchase.orders.create";
export const PURCHASE_VENDORS_CREATE = "purchase.vendors.create";
export const PURCHASE_VENDORS_EDIT = "purchase.vendors.edit";

export interface VendorInput {
  name: string; code?: string | null; category?: string | null; contactPerson?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; taxNumber?: string | null; paymentTerms?: string | null;
  currency?: string | null; notes?: string | null; status?: string; rating?: number;
}

export const purchaseWriteApi = {
  createOrder: (b: { vendorId: string; notes: string | null; expectedDate: string | null; lines: Line[] }) =>
    apiClient.post<{ id: string; orderNumber: string }>(`${BASE}/orders`, {
      vendorId: b.vendorId, notes: b.notes, expectedDate: b.expectedDate,
      items: b.lines.map((l) => ({
        productId: l.productId, description: l.description.trim(), quantity: toNumber(l.quantity),
        unitCost: toNumber(l.unitPrice || "0"), taxRate: toNumber(l.taxRate || "0") || 0,
      })),
    }),

  createVendor: (v: VendorInput) => apiClient.post<{ id: string; name: string }>(`${BASE}/vendors`, v),

  updateVendor: async (id: string, patch: Partial<VendorInput>): Promise<void> => {
    const cur = await apiClient.get<Record<string, unknown>>(`${BASE}/vendors/${id}`);
    const body = {
      name: cur.name, code: cur.code ?? null, category: cur.category ?? null, contactPerson: cur.contactPerson ?? null,
      email: cur.email ?? null, phone: cur.phone ?? null, address: cur.address ?? null, taxNumber: cur.taxNumber ?? null,
      paymentTerms: cur.paymentTerms ?? null, currency: cur.currency ?? null, notes: cur.notes ?? null,
      status: cur.status, rating: cur.rating, ...patch,
    };
    await apiClient.put(`${BASE}/vendors/${id}`, body);
  },
};
