import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/ecommerce/store`;

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types (mirror Softaxis.Ecommerce.Application.StoreAdmin) ─────────────────

export interface StoreSettings {
  id: string; name: string; slug: string; customDomain: string | null; isPublished: boolean; currencyCode: string; language: "en" | "ar";
  contactEmail: string | null; contactPhone: string | null; address: string | null; orderNotifyEmail: string | null;
  logoAssetId: string | null; faviconAssetId: string | null; announcementText: string | null; seoTitle: string | null; metaDescription: string | null;
  themeJson: string; headerMenuJson: string; footerMenuJson: string; socialJson: string;
  taxPercent: number; pricesIncludeTax: boolean; allowGuestCheckout: boolean; requirePhone: boolean;
  codEnabled: boolean; codInstructions: string | null; bankEnabled: boolean; bankDetails: string | null;
  stripeEnabled: boolean; hasStripeSecret: boolean; hasStripeWebhookSecret: boolean;
  payPalEnabled: boolean; payPalClientId: string | null; hasPayPalSecret: boolean; payPalSandbox: boolean;
  publicUrl: string; stripeWebhookUrl: string;
}

/** What is sent when saving. A secret left null is kept; an empty string removes it. */
export type StoreSettingsUpdate = Omit<StoreSettings, "id" | "hasStripeSecret" | "hasStripeWebhookSecret" | "hasPayPalSecret" | "publicUrl" | "stripeWebhookUrl"> & {
  stripeSecretKey: string | null; stripeWebhookSecret: string | null; payPalSecret: string | null;
};

export interface PageSummary { id: string; slug: string; title: string; kind: "home" | "page" | "policy"; isPublished: boolean; sectionCount: number; updatedAt: string | null }
export interface PageDetail { id: string; slug: string; title: string; kind: "home" | "page" | "policy"; isPublished: boolean; sectionsJson: string; seoTitle: string | null; metaDescription: string | null }
export interface PageInput { slug: string; title: string; kind: string; isPublished: boolean; sectionsJson: string; seoTitle: string | null; metaDescription: string | null }

export interface AssetDto { id: string; fileName: string; contentType: string; size: number }

export interface CollectionDto { id: string; slug: string; name: string; description: string | null; imageAssetId: string | null; templateIds: string[]; categoryName: string | null; isPublished: boolean; sortOrder: number }
export type CollectionInput = Omit<CollectionDto, "id">;

export interface ShippingZoneDto { id: string; name: string; countries: string[]; flatRate: number; freeOver: number | null; minOrder: number | null; estimatedDays: string | null; isActive: boolean; sortOrder: number }
export type ShippingZoneInput = Omit<ShippingZoneDto, "id">;

export interface DiscountDto { id: string; code: string; kind: "percent" | "fixed" | "free_shipping"; value: number; minSubtotal: number | null; maxUses: number | null; usedCount: number; startsAt: string | null; endsAt: string | null; isActive: boolean }
export type DiscountInput = Omit<DiscountDto, "id" | "usedCount">;

export type StoreOrderStatus = "awaiting_payment" | "placed" | "shipped" | "delivered" | "cancelled";
export type StorePaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface StoreOrderSummary { id: string; number: string; status: StoreOrderStatus; paymentMethod: string; paymentStatus: StorePaymentStatus; customerName: string; email: string; total: number; currencyCode: string; itemCount: number; createdAt: string }
export interface StoreOrdersSummary { toFulfil: number; awaitingPayment: number; shipped: number; revenue30Days: number; orders30Days: number; currencyCode: string }
export interface StoreOrder {
  id: string; number: string; status: StoreOrderStatus; paymentMethod: string; paymentStatus: StorePaymentStatus; email: string; phone: string | null; customerName: string;
  shipName: string; shipLine1: string; shipLine2: string | null; shipCity: string; shipRegion: string | null; shipPostal: string | null; shipCountry: string;
  shippingMethod: string | null; subtotal: number; discountTotal: number; discountCode: string | null; shippingTotal: number; taxTotal: number; total: number; currencyCode: string;
  paymentReference: string | null; paidAt: string | null; trackingCarrier: string | null; trackingNumber: string | null; trackingUrl: string | null;
  shippedAt: string | null; deliveredAt: string | null; cancelledAt: string | null; cancelReason: string | null; customerNote: string | null; staffNote: string | null; createdAt: string;
  lines: { productId: string; title: string; variantName: string | null; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  events: { kind: string; message: string; byName: string | null; at: string }[];
}
export interface StoreCustomer { id: string; email: string; name: string; phone: string | null; acceptsMarketing: boolean; orders: number; totalSpent: number; createdAt: string; lastSignInAt: string | null }
export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }

// ── Client ───────────────────────────────────────────────────────────────────

/** A store that does not exist yet answers 404; that is "not set up", not a failure. */
const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch((e: Error & { statusCode?: number }) => { if (e.statusCode === 404) return null; throw e; });

export const storeApi = {
  get: (): Promise<StoreSettings | null> => orNull(rawApiClient.get<StoreSettings>(BASE)),
  create: (name: string, slug: string): Promise<StoreSettings> => rawApiClient.post(BASE, { name, slug }),
  update: (b: StoreSettingsUpdate): Promise<StoreSettings> => rawApiClient.put(BASE, b),

  pages: (): Promise<PageSummary[]> => rawApiClient.get(`${BASE}/pages`),
  page: (id: string): Promise<PageDetail> => rawApiClient.get(`${BASE}/pages/${id}`),
  createPage: (b: PageInput): Promise<PageDetail> => rawApiClient.post(`${BASE}/pages`, b),
  updatePage: (id: string, b: PageInput): Promise<PageDetail> => rawApiClient.put(`${BASE}/pages/${id}`, b),
  deletePage: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/pages/${id}`),

  assets: (): Promise<AssetDto[]> => rawApiClient.get(`${BASE}/assets`),
  upload: async (file: File): Promise<AssetDto> => {
    const form = new FormData();
    form.append("file", file);
    return rawApiClient.postForm(`${BASE}/assets`, form);
  },

  collections: (): Promise<CollectionDto[]> => rawApiClient.get(`${BASE}/collections`),
  saveCollection: (id: string | null, b: CollectionInput): Promise<CollectionDto> => id ? rawApiClient.put(`${BASE}/collections/${id}`, b) : rawApiClient.post(`${BASE}/collections`, b),
  deleteCollection: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/collections/${id}`),

  shipping: (): Promise<ShippingZoneDto[]> => rawApiClient.get(`${BASE}/shipping`),
  saveZone: (id: string | null, b: ShippingZoneInput): Promise<ShippingZoneDto> => id ? rawApiClient.put(`${BASE}/shipping/${id}`, b) : rawApiClient.post(`${BASE}/shipping`, b),
  deleteZone: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/shipping/${id}`),

  discounts: (): Promise<DiscountDto[]> => rawApiClient.get(`${BASE}/discounts`),
  saveDiscount: (id: string | null, b: DiscountInput): Promise<DiscountDto> => id ? rawApiClient.put(`${BASE}/discounts/${id}`, b) : rawApiClient.post(`${BASE}/discounts`, b),
  deleteDiscount: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/discounts/${id}`),

  orders: (p: { search?: string; status?: string; paymentStatus?: string; page?: number; pageSize?: number }): Promise<Paged<StoreOrderSummary>> => rawApiClient.get(`${BASE}/orders${qs(p)}`),
  ordersSummary: (): Promise<StoreOrdersSummary> => rawApiClient.get(`${BASE}/orders/summary`),
  order: (id: string): Promise<StoreOrder> => rawApiClient.get(`${BASE}/orders/${id}`),
  markPaid: (id: string, reference?: string): Promise<StoreOrder> => rawApiClient.post(`${BASE}/orders/${id}/paid`, { reference }),
  ship: (id: string, b: { carrier?: string; trackingNumber?: string; trackingUrl?: string }): Promise<StoreOrder> => rawApiClient.post(`${BASE}/orders/${id}/ship`, b),
  deliver: (id: string): Promise<StoreOrder> => rawApiClient.post(`${BASE}/orders/${id}/deliver`, {}),
  cancel: (id: string, reason?: string): Promise<StoreOrder> => rawApiClient.post(`${BASE}/orders/${id}/cancel`, { reason }),
  refund: (id: string, reason?: string): Promise<StoreOrder> => rawApiClient.post(`${BASE}/orders/${id}/refund`, { reason }),
  setNote: (id: string, note: string): Promise<StoreOrder> => rawApiClient.put(`${BASE}/orders/${id}/note`, { note }),

  customers: (p: { search?: string; page?: number; pageSize?: number }): Promise<Paged<StoreCustomer>> => rawApiClient.get(`${BASE}/customers${qs(p)}`),
};
