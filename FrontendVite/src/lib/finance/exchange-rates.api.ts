import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/finance/exchange-rates`;

/** A stored daily rate: units of USD (base) per 1 unit of {currencyCode}. */
export interface ExchangeRateDto {
  id: string;
  currencyCode: string;
  rateDate: string;      // yyyy-MM-dd
  rate: number;          // USD per 1 unit of currencyCode
  createdAt: string;
  updatedAt?: string | null;
}

export interface ConvertCurrencyDto {
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
  amount: number;
  convertedAmount: number;
}

export interface RefreshRatesDto {
  updated: number;
  asOf: string;
}

export const exchangeRatesApi = {
  getAll: (currencyCode?: string): Promise<ExchangeRateDto[]> =>
    rawApiClient.get(`${BASE}${currencyCode ? `?currencyCode=${encodeURIComponent(currencyCode)}` : ""}`),

  convert: (from: string, to: string, amount: number, asOf?: string): Promise<ConvertCurrencyDto> =>
    rawApiClient.get(
      `${BASE}/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}` +
      (asOf ? `&asOf=${encodeURIComponent(asOf)}` : ""),
    ),

  refresh: (): Promise<RefreshRatesDto> => rawApiClient.post(`${BASE}/refresh`, {}),
};
