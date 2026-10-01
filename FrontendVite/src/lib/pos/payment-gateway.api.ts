import { apiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/paymentgateway`;

export interface PaymentGatewayConfigDto {
  provider: string;
  hasApiKey: boolean;
  hasSecretKey: boolean;
  publicKey: string | null;
  mode: "test" | "live";
  isEnabled: boolean;
}

export interface PaymentGatewayCatalogEntryDto {
  key: string;
  displayName: string;
  status: "active" | "coming_soon";
  needsApiKey: boolean;
  needsSecretKey: boolean;
  needsPublicKey: boolean;
  setupHint: string;
}

export interface UpsertPaymentGatewayConfigRequest {
  provider: string;
  apiKey?: string | null;
  secretKey?: string | null;
  publicKey?: string | null;
  mode: "test" | "live";
  isEnabled: boolean;
}

export const paymentGatewayApi = {
  getCatalog: (): Promise<PaymentGatewayCatalogEntryDto[]> =>
    apiClient.get<PaymentGatewayCatalogEntryDto[]>(`${BASE}/catalog`),

  getConfig: (): Promise<PaymentGatewayConfigDto> =>
    apiClient.get<PaymentGatewayConfigDto>(BASE),

  upsertConfig: (req: UpsertPaymentGatewayConfigRequest): Promise<PaymentGatewayConfigDto> =>
    apiClient.put<PaymentGatewayConfigDto>(BASE, req),
};
