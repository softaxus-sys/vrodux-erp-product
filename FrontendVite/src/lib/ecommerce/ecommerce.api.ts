import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/ecommerce`;

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types (mirror Softaxis.Ecommerce.Application) ────────────────────────────

export type ChannelStatus = "connected" | "error" | "paused";
export type ListingStatus = "pending" | "live" | "draft" | "error";
export type OrderStatus = "imported" | "unmatched" | "cancelled";

export interface ProviderInfo { kind: string; name: string; description: string; available: boolean; requirements: string }

export interface ChannelDto {
  id: string; kind: string; name: string; shopDomain: string; status: ChannelStatus;
  locationId: string | null; locationName: string | null; currencyCode: string | null;
  syncStock: boolean; syncContent: boolean; importOrders: boolean;
  lastSyncAt: string | null; lastError: string | null; consecutiveFailures: number;
  liveListings: number; failedListings: number; orders: number; createdAt: string;
}

export interface ListingDto {
  id: string; channelId: string; channelName: string; templateId: string; templateName: string;
  externalProductId: string | null; adminUrl: string | null; status: ListingStatus; lastError: string | null;
  lastSyncedAt: string | null; variantCount: number; createdAt: string;
}

export interface OrderLineDto { title: string; sku: string | null; quantity: number; unitPrice: number; productId: string | null; stockTaken: boolean; stockReturned: boolean }

export interface ChannelOrderDto {
  id: string; channelId: string; channelName: string; externalId: string; orderNumber: string; status: OrderStatus;
  customerName: string | null; email: string | null; financialStatus: string | null; fulfillmentStatus: string | null;
  total: number; currencyCode: string | null; placedAt: string; importedAt: string; note: string | null;
  lines: OrderLineDto[];
}

export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }
export interface LocationDto { id: string; name: string; active: boolean }
export interface TemplateLookupDto { id: string; name: string; variantCount: number; totalStock: number; publishedOnline: boolean; isActive: boolean }
export interface SyncResultDto { productsPushed: number; stockUpdates: number; ordersImported: number; ordersCancelled: number; errors: string[] }

export interface ConnectChannelRequest { kind: string; name: string; shopDomain: string; accessToken: string }
export interface UpdateChannelRequest { name: string; syncStock: boolean; syncContent: boolean; importOrders: boolean; locationId: string | null; paused: boolean }

// ── Client ───────────────────────────────────────────────────────────────────

export const ecommerceApi = {
  providers: (): Promise<ProviderInfo[]> => rawApiClient.get(`${BASE}/channels/providers`),
  channels: (): Promise<ChannelDto[]> => rawApiClient.get(`${BASE}/channels`),
  channel: (id: string): Promise<ChannelDto> => rawApiClient.get(`${BASE}/channels/${id}`),
  locations: (id: string): Promise<LocationDto[]> => rawApiClient.get(`${BASE}/channels/${id}/locations`),
  connect: (r: ConnectChannelRequest): Promise<ChannelDto> => rawApiClient.post(`${BASE}/channels/connect`, r),
  updateChannel: (id: string, r: UpdateChannelRequest): Promise<ChannelDto> => rawApiClient.put(`${BASE}/channels/${id}`, r),
  replaceToken: (id: string, accessToken: string): Promise<ChannelDto> => rawApiClient.put(`${BASE}/channels/${id}/token`, { accessToken }),
  disconnect: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/channels/${id}`),
  syncChannel: (id: string, resetStock = false): Promise<SyncResultDto> =>
    rawApiClient.post(`${BASE}/channels/${id}/sync${qs({ resetStock })}`, {}),
  importOrders: (id: string): Promise<SyncResultDto> => rawApiClient.post(`${BASE}/channels/${id}/orders/import`, {}),

  listings: (params: { channelId?: string; templateId?: string } = {}): Promise<ListingDto[]> =>
    rawApiClient.get(`${BASE}/listings${qs(params)}`),
  publish: (channelId: string, templateId: string): Promise<ListingDto> => rawApiClient.post(`${BASE}/listings`, { channelId, templateId }),
  syncListing: (id: string): Promise<ListingDto> => rawApiClient.post(`${BASE}/listings/${id}/sync`, {}),
  unpublish: (id: string): Promise<ListingDto> => rawApiClient.post(`${BASE}/listings/${id}/unpublish`, {}),
  removeListing: (id: string, deleteInStore: boolean): Promise<void> => rawApiClient.delete(`${BASE}/listings/${id}${qs({ deleteInStore })}`),

  orders: (params: { channelId?: string; search?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Paged<ChannelOrderDto>> =>
    rawApiClient.get(`${BASE}/orders${qs(params)}`),

  templates: (search: string): Promise<TemplateLookupDto[]> => rawApiClient.get(`${BASE}/lookups/templates${qs({ search })}`),
};

// ── Display helpers ──────────────────────────────────────────────────────────

export const CHANNEL_STATUS_META: Record<ChannelStatus, { color: string; bg: string }> = {
  connected: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  error:     { color: "text-red-700 dark:text-red-300",         bg: "bg-red-100 dark:bg-red-900/30" },
  paused:    { color: "text-slate-600 dark:text-slate-300",     bg: "bg-slate-100 dark:bg-slate-800/50" },
};

export const LISTING_STATUS_META: Record<ListingStatus, { color: string; bg: string }> = {
  live:    { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  draft:   { color: "text-slate-600 dark:text-slate-300",     bg: "bg-slate-100 dark:bg-slate-800/50" },
  pending: { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/30" },
  error:   { color: "text-red-700 dark:text-red-300",         bg: "bg-red-100 dark:bg-red-900/30" },
};

export const ORDER_STATUS_META: Record<OrderStatus, { color: string; bg: string }> = {
  imported:  { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  unmatched: { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/30" },
  cancelled: { color: "text-slate-600 dark:text-slate-300",     bg: "bg-slate-100 dark:bg-slate-800/50" },
};

/** Never index a config map bare: a status the server adds later must not take the page down. */
export const meta = <T extends string>(map: Record<T, { color: string; bg: string }>, key: string) =>
  map[key as T] ?? { color: "text-slate-600", bg: "bg-slate-100" };
