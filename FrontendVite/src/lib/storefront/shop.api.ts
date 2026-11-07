import { getApiBaseUrl } from "@/lib/desktop";
import { useAuthStore } from "@/store/auth.store";

/**
 * Client for the public storefront API (api/ecommerce/shop/{slug}). Plain fetch on purpose, not rawApiClient: that client
 * attaches the ERP user's token and bounces to /login on a 401, which would throw a shopper out of their own checkout.
 * The one exception is preview — a signed-in staff member looking at a store that is not open yet sends their token so the
 * server can tell them apart from the public.
 */

// ── Types (mirror Softaxis.Ecommerce.Application.Shop) ───────────────────────

export interface ShopPaymentMethod { method: "stripe" | "paypal" | "cod" | "bank"; label: string; instructions: string | null }

export interface ShopInfo {
  name: string; slug: string; currencyCode: string; language: "en" | "ar";
  contactEmail: string | null; contactPhone: string | null; address: string | null;
  logoAssetId: string | null; faviconAssetId: string | null; announcementText: string | null;
  seoTitle: string | null; metaDescription: string | null;
  themeJson: string; headerMenuJson: string; footerMenuJson: string; socialJson: string;
  taxPercent: number; pricesIncludeTax: boolean; allowGuestCheckout: boolean; requirePhone: boolean;
  paymentMethods: ShopPaymentMethod[]; countries: string[]; allCountries: boolean;
}

export interface ShopCard {
  id: string; name: string; slug: string; shortDescription: string | null; categoryName: string; brandName: string | null;
  priceFrom: number; priceTo: number; coverImageId: string | null; inStock: boolean;
}
export interface ShopVariant { productId: string; name: string; sku: string | null; options: Record<string, string>; price: number; inStock: boolean; remaining: number | null }
export interface ShopImage { id: string; productId: string | null; alt: string | null }
export interface ShopProduct {
  id: string; name: string; slug: string; description: string | null; shortDescription: string | null; categoryName: string; brandName: string | null;
  seoTitle: string | null; metaDescription: string | null; options: { name: string; values: string[] }[];
  variants: ShopVariant[]; images: ShopImage[]; related: ShopCard[];
}
export interface ShopCategory { name: string; count: number }
export interface ShopCollection { slug: string; name: string; description: string | null; imageAssetId: string | null }
export interface ShopPage { slug: string; title: string; kind: string; sectionsJson: string; seoTitle: string | null; metaDescription: string | null }
export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }

export interface CartLine { productId: string; quantity: number }
export interface QuoteLine {
  productId: string; productSlug: string; title: string; variantName: string | null; sku: string | null; templateId: string; coverImageId: string | null;
  unitPrice: number; quantity: number; lineTotal: number; maxQuantity: number | null; problem: string | null;
}
export interface ShippingOption { zoneId: string; name: string; price: number; estimatedDays: string | null; free: boolean }
export interface Quote {
  lines: QuoteLine[]; subtotal: number; discountTotal: number; discountCode: string | null; discountError: string | null;
  shippingOptions: ShippingOption[]; selectedZoneId: string | null; shippingTotal: number; taxTotal: number; total: number;
  currencyCode: string; canCheckout: boolean; blockedReason: string | null;
}

export interface CheckoutRequest {
  items: CartLine[]; discountCode?: string | null; email: string; phone?: string | null; name: string;
  line1: string; line2?: string | null; city: string; region?: string | null; postalCode?: string | null; country: string;
  zoneId: string; paymentMethod: string; note?: string | null; saveAddress?: boolean;
}
export interface CheckoutResult { orderNumber: string; accessToken: string; status: string; paymentStatus: string; redirectUrl: string | null }

export interface ShopOrder {
  number: string; status: string; paymentMethod: string; paymentStatus: string; currencyCode: string; email: string; customerName: string;
  shipName: string; shipLine1: string; shipLine2: string | null; shipCity: string; shipRegion: string | null; shipPostal: string | null; shipCountry: string;
  shippingMethod: string | null; subtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; total: number;
  trackingCarrier: string | null; trackingNumber: string | null; trackingUrl: string | null; createdAt: string; canPay: boolean;
  paymentInstructions: string | null; lines: { title: string; variantName: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
}

export interface ShopCustomer { id: string; email: string; firstName: string; lastName: string; phone: string | null; acceptsMarketing: boolean }
export interface ShopAddress { id: string; name: string; phone: string | null; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null; country: string; isDefault: boolean }
export interface ShopSession { token: string; expiresAt: string; customer: ShopCustomer }
export interface ShopAccount { customer: ShopCustomer; addresses: ShopAddress[] }
export interface ShopOrderSummary { number: string; accessToken: string; status: string; paymentStatus: string; total: number; currencyCode: string; itemCount: number; createdAt: string }

export class ShopApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
  get unauthorized() { return this.status === 401; }
}

// ── Transport ────────────────────────────────────────────────────────────────

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

const PREVIEW_KEY = "storefront:preview";
/**
 * Where the store's API lives. Normally the ERP's own address, but a store served from its own domain (or sub-domain) talks to
 * that same domain: the web server in front of it forwards /api to the gateway, and calling the ERP's address from another
 * origin would be a cross-origin request the gateway refuses.
 */
let storeApiOrigin: string | null = null;
export const setStoreApiOrigin = (origin: string | null) => { storeApiOrigin = origin; };
const apiBase = () => storeApiOrigin ?? getApiBaseUrl();

export const isPreview = () => { try { return sessionStorage.getItem(PREVIEW_KEY) === "1"; } catch { return false; } };
export const setPreview = (on: boolean) => { try { on ? sessionStorage.setItem(PREVIEW_KEY, "1") : sessionStorage.removeItem(PREVIEW_KEY); } catch { /* storage blocked: preview just stays off */ } };

async function call<T>(slug: string, path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers["X-Shop-Token"] = init.token;
  // Only when previewing, and only the staff member's own sign-in: lets the owner see a store that is not open yet.
  if (isPreview()) {
    const t = useAuthStore.getState().token;
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${apiBase()}/api/ecommerce/shop/${encodeURIComponent(slug)}${path}`, {
    method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const b = (data ?? {}) as Record<string, unknown>;
    const fieldErrors = b.errors && typeof b.errors === "object" ? Object.values(b.errors as Record<string, string[]>).flat() : [];
    const msg = (b.description as string) ?? (b.detail as string) ?? fieldErrors[0] ?? (res.status === 429 ? "Too many requests. Please wait a moment." : `Something went wrong (${res.status}).`);
    throw new ShopApiError(msg, res.status, b.code as string | undefined);
  }
  return data as T;
}

export const shopApi = {
  resolveHost: async (host: string): Promise<{ slug: string } | null> => {
    // Same origin on purpose: an unknown address is one whose web server forwards /api to us; the baked-in ERP address would be cross-origin.
    const res = await fetch(`${window.location.origin}/api/ecommerce/shop-host${qs({ host })}`);
    return res.ok ? res.json() : null;
  },
  info: (slug: string) => call<ShopInfo>(slug, ""),
  products: (slug: string, p: { q?: string; category?: string; collection?: string; sort?: string; page?: number; pageSize?: number }) =>
    call<Paged<ShopCard>>(slug, `/products${qs(p)}`),
  product: (slug: string, productSlug: string) => call<ShopProduct>(slug, `/products/${encodeURIComponent(productSlug)}`),
  categories: (slug: string) => call<ShopCategory[]>(slug, "/categories"),
  collections: (slug: string) => call<ShopCollection[]>(slug, "/collections"),
  page: (slug: string, pageSlug: string) => call<ShopPage>(slug, `/pages/${encodeURIComponent(pageSlug)}`),

  quote: (slug: string, items: CartLine[], discountCode: string | null, country: string | null, zoneId: string | null) =>
    call<Quote>(slug, "/quote", { method: "POST", body: { items, discountCode, country, zoneId } }),
  checkout: (slug: string, body: CheckoutRequest, token: string | null) => call<CheckoutResult>(slug, "/checkout", { method: "POST", body, token }),
  order: (slug: string, number: string, key: string) => call<ShopOrder>(slug, `/orders/${encodeURIComponent(number)}${qs({ token: key })}`),
  capturePayPal: (slug: string, number: string, key: string, paypalOrderId: string) =>
    call<ShopOrder>(slug, `/orders/${encodeURIComponent(number)}/paypal/capture${qs({ token: key })}`, { method: "POST", body: { payPalOrderId: paypalOrderId } }),
  payAgain: (slug: string, number: string, key: string) => call<CheckoutResult>(slug, `/orders/${encodeURIComponent(number)}/pay${qs({ token: key })}`, { method: "POST" }),

  register: (slug: string, b: { email: string; password: string; firstName: string; lastName: string; phone?: string; acceptsMarketing: boolean }) =>
    call<ShopSession>(slug, "/account/register", { method: "POST", body: b }),
  signIn: (slug: string, email: string, password: string) => call<ShopSession>(slug, "/account/sign-in", { method: "POST", body: { email, password } }),
  account: (slug: string, token: string) => call<ShopAccount>(slug, "/account", { token }),
  updateAccount: (slug: string, token: string, b: { firstName: string; lastName: string; phone?: string | null; acceptsMarketing: boolean; currentPassword?: string; newPassword?: string }) =>
    call<ShopAccount>(slug, "/account", { method: "PUT", body: b, token }),
  myOrders: (slug: string, token: string, page = 1) => call<Paged<ShopOrderSummary>>(slug, `/account/orders${qs({ page })}`, { token }),
  saveAddress: (slug: string, token: string, id: string | null, a: Omit<ShopAddress, "id">) =>
    call<ShopAddress>(slug, id ? `/account/addresses/${id}` : "/account/addresses", { method: id ? "PUT" : "POST", body: a, token }),
  deleteAddress: (slug: string, token: string, id: string) => call<void>(slug, `/account/addresses/${id}`, { method: "DELETE", token }),
  forgotPassword: (slug: string, email: string) => call<void>(slug, "/account/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (slug: string, email: string, token: string, newPassword: string) =>
    call<void>(slug, "/account/reset-password", { method: "POST", body: { email, token, newPassword } }),
};

// ── Pictures ─────────────────────────────────────────────────────────────────

export const shopBase = (slug: string) => `${apiBase()}/api/ecommerce/shop/${encodeURIComponent(slug)}`;
export const productImageUrl = (slug: string, templateId: string, imageId: string) => `${shopBase(slug)}/images/${templateId}/${imageId}`;
export const assetUrl = (slug: string, assetId: string) => `${shopBase(slug)}/assets/${assetId}`;

// ── Theme / settings JSON ────────────────────────────────────────────────────

export interface ShopTheme {
  preset: string; primary: string; accent: string; background: string; surface: string; text: string; muted: string;
  headingFont: string; bodyFont: string; radius: "none" | "sm" | "md" | "lg" | "full"; cardStyle: "plain" | "bordered" | "shadow";
  productColumns: number; headerStyle: "left" | "center";
}

export const DEFAULT_THEME: ShopTheme = {
  preset: "classic", primary: "#111827", accent: "#2563eb", background: "#ffffff", surface: "#f9fafb", text: "#111827", muted: "#6b7280",
  headingFont: "inter", bodyFont: "inter", radius: "md", cardStyle: "plain", productColumns: 4, headerStyle: "left",
};

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export interface MenuItem { label: string; url: string }
export type Social = Partial<Record<"instagram" | "facebook" | "x" | "tiktok" | "youtube" | "whatsapp", string>>;

export interface Section { id: string; type: string; settings: Record<string, unknown> }
