import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/paymentgateway`;

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
