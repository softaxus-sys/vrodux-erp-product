import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/payment-methods`;

// â”€â”€â”€ DTOs (mirrors backend PaymentMethodConfigDto) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Request shapes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PaymentMethodSaveItem {
  code: string;
  label: string;
  isEnabled: boolean;
  sortOrder: number;
  isCustom: boolean;
}

// â”€â”€â”€ API client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const paymentMethodsApi = {
  /** GET /api/payment-methods â€” returns all methods ordered by sortOrder */
  getAll: (): Promise<PaymentMethodDto[]> =>
    apiClient.get<PaymentMethodDto[]>(BASE),

  /** PUT /api/payment-methods â€” bulk save IsEnabled/SortOrder, create custom */
  save: (items: PaymentMethodSaveItem[]): Promise<PaymentMethodDto[]> =>
    apiClient.put<PaymentMethodDto[]>(BASE, { items }),

  /** DELETE /api/payment-methods/{id} â€” soft-delete custom method (204 No Content) */
  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),
};
