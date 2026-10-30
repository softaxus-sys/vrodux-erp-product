import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/billing/credits`;
const ADMIN = `${getApiBaseUrl()}/api/admin/billing-config/credit-pricing`;

/** One add-on card: what it is, what a credit costs, and what the workspace holds. */
export interface CreditProductDto {
  moduleKey: string;
  name: string;
  description: string;
  howItWorks: string[];
  unitName: string;
  forSale: boolean;
  /** USD price of one credit, before any volume discount. */
  pricePerCredit: number;
  balance: number;
  /** Credits that can be moved to another module (free credits cannot). */
  swappable: number;
}

export interface CreditTierDto { fromCredits: number; discountPercent: number }

export interface CreditCatalogDto {
  products: CreditProductDto[];
  tiers: CreditTierDto[];
  minCredits: number;
  minOrderUsd: number;
  maxOrderUsd: number;
  vatPercent: number;
  currency: string;
  providers: string[];
  swapEnabled: boolean;
  swapFeePercent: number;
  minSwapCredits: number;
}

export interface CreditQuoteDto {
  moduleKey: string; credits: number; unitPrice: number; discountPercent: number;
  grossAmount: number; netAmount: number; vatPercent: number; vatAmount: number; totalAmount: number; currency: string;
}

export interface CreditPurchaseDto {
  id: string; moduleKey: string; credits: number; unitPrice: number; discountPercent: number; totalAmount: number;
  currency: string; provider: string; status: "pending" | "paid" | "credited" | "failed" | string;
  error: string | null; purchasedBy: string | null; createdAt: string; creditedAt: string | null;
}

export interface CreditSwapQuoteDto {
  fromModule: string; toModule: string; requestedCredits: number; creditsTaken: number; creditsReceived: number;
  fromPrice: number; toPrice: number; feePercent: number; valueMoved: number; valueReceived: number; formula: string;
}

export interface CreditSwapDto {
  id: string; fromModule: string; toModule: string; fromCredits: number; toCredits: number;
  fromPrice: number; toPrice: number; feePercent: number; status: "pending" | "removed" | "done" | "failed" | string;
  error: string | null; swappedBy: string | null; createdAt: string;
}

export interface CreditCheckoutDto { purchaseId: string; url: string; provider: string }

export interface CreditPricingDto {
  pricePerCredit: Record<string, number>;
  tiers: CreditTierDto[];
  minCredits: number; minOrderUsd: number; maxOrderUsd: number; vatPercent: number;
  swapEnabled: boolean; swapFeePercent: number; minSwapCredits: number;
  modules: { moduleKey: string; name: string }[];
}

export interface UpdateCreditPricingRequest {
  pricePerCredit: Record<string, number>;
  tiers: CreditTierDto[];
  minCredits: number; minOrderUsd: number; maxOrderUsd: number; vatPercent: number;
  swapEnabled: boolean; swapFeePercent: number; minSwapCredits: number;
}

export const creditsApi = {
  catalog: (): Promise<CreditCatalogDto> => apiClient.get(BASE),
  quote: (module: string, credits: number): Promise<CreditQuoteDto> =>
    apiClient.get(`${BASE}/quote?module=${encodeURIComponent(module)}&credits=${credits}`),
  checkout: (module: string, credits: number, provider: string): Promise<CreditCheckoutDto> =>
    apiClient.post(`${BASE}/checkout`, { module, credits, provider }),
  capturePayPal: (orderId: string): Promise<CreditPurchaseDto> => apiClient.post(`${BASE}/paypal/capture`, { orderId }),
  purchases: (): Promise<CreditPurchaseDto[]> => apiClient.get(`${BASE}/purchases`),
  swapQuote: (from: string, to: string, credits: number): Promise<CreditSwapQuoteDto> =>
    apiClient.get(`${BASE}/swap/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&credits=${credits}`),
  swap: (from: string, to: string, credits: number): Promise<CreditSwapDto> => apiClient.post(`${BASE}/swap`, { from, to, credits }),
  swaps: (): Promise<CreditSwapDto[]> => apiClient.get(`${BASE}/swaps`),
};

export const creditPricingAdminApi = {
  get: (): Promise<CreditPricingDto> => apiClient.get(ADMIN),
  update: (body: UpdateCreditPricingRequest): Promise<CreditPricingDto> => apiClient.put(ADMIN, body),
};
