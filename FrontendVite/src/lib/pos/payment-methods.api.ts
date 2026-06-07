import { apiClient, rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/payment-methods`;

// ─── DTOs (mirrors backend PaymentMethodConfigDto) ────────────────────────────

export interface PaymentMethodDto {
  id: string;
  code: string;
  label: string;
  iconKey: string;
  countries: string;       // comma-separated or "*"
  description: string | null;
  sortOrder: number;
  isEnabled: boolean;
  isSystem: boolean;
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface PaymentMethodSaveItem {
  code: string;
  label: string;
  isEnabled: boolean;
  sortOrder: number;
  isCustom: boolean;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const paymentMethodsApi = {
  /** GET /api/payment-methods — returns all methods ordered by sortOrder */
  getAll: (): Promise<PaymentMethodDto[]> =>
    apiClient.get<PaymentMethodDto[]>(BASE),

  /** PUT /api/payment-methods — bulk save IsEnabled/SortOrder, create custom */
  save: (items: PaymentMethodSaveItem[]): Promise<PaymentMethodDto[]> =>
    apiClient.put<PaymentMethodDto[]>(BASE, { items }),

  /** DELETE /api/payment-methods/{id} — soft-delete custom method (204 No Content) */
  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
