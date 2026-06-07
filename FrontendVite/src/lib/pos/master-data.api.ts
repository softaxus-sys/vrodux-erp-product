import { apiClient, rawApiClient } from "@/lib/api-client";

const POS = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CurrencyDto {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TaxRateDto {
  id: string;
  name: string;
  code: string;
  rate: number;
  appliesTo: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PaymentTermDto {
  id: string;
  name: string;
  code: string;
  daysNet: number;
  advancePercent: number;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CustomerGroupDto {
  id: string;
  name: string;
  code: string;
  discountPercent: number;
  minPurchase: number;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Request types ────────────────────────────────────────────────────────────

export interface UpsertCurrencyRequest {
  id?: string | null;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface UpsertTaxRateRequest {
  id?: string | null;
  name: string;
  code: string;
  rate: number;
  appliesTo: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface UpsertPaymentTermRequest {
  id?: string | null;
  name: string;
  code: string;
  daysNet: number;
  advancePercent: number;
  description?: string | null;
  isDefault: boolean;
}

export interface UpsertCustomerGroupRequest {
  id?: string | null;
  name: string;
  code: string;
  discountPercent: number;
  minPurchase: number;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

// ─── API clients ──────────────────────────────────────────────────────────────

export const currenciesApi = {
  getAll: (): Promise<CurrencyDto[]> =>
    apiClient.get<CurrencyDto[]>(`${POS}/api/currencies`),

  upsert: (req: UpsertCurrencyRequest): Promise<CurrencyDto> =>
    apiClient.put<CurrencyDto>(`${POS}/api/currencies`, req),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${POS}/api/currencies/${id}`),
};

export const taxRatesApi = {
  getAll: (): Promise<TaxRateDto[]> =>
    apiClient.get<TaxRateDto[]>(`${POS}/api/tax-rates`),

  upsert: (req: UpsertTaxRateRequest): Promise<TaxRateDto> =>
    apiClient.put<TaxRateDto>(`${POS}/api/tax-rates`, req),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${POS}/api/tax-rates/${id}`),
};

export const paymentTermsApi = {
  getAll: (): Promise<PaymentTermDto[]> =>
    apiClient.get<PaymentTermDto[]>(`${POS}/api/payment-terms`),

  upsert: (req: UpsertPaymentTermRequest): Promise<PaymentTermDto> =>
    apiClient.put<PaymentTermDto>(`${POS}/api/payment-terms`, req),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${POS}/api/payment-terms/${id}`),
};

export const customerGroupsApi = {
  getAll: (): Promise<CustomerGroupDto[]> =>
    apiClient.get<CustomerGroupDto[]>(`${POS}/api/customer-groups`),

  upsert: (req: UpsertCustomerGroupRequest): Promise<CustomerGroupDto> =>
    apiClient.put<CustomerGroupDto>(`${POS}/api/customer-groups`, req),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${POS}/api/customer-groups/${id}`),
};
