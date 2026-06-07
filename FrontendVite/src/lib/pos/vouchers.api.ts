import { apiClient } from "@/lib/api-client";
import type { VoucherDto, VoucherValidationDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/vouchers`;

export interface UpsertVoucherPayload {
  id?:                string | null;
  code:               string;
  description?:        string | null;
  valueType:          number;            // 1 = Percentage, 2 = FixedAmount
  value:              number;
  minSpend:           number;
  maxDiscountAmount?: number | null;
  validFrom?:         string | null;
  validUntil?:        string | null;
  usageLimit?:        number | null;
  isActive:           boolean;
}

export const vouchersApi = {
  getAll: (): Promise<VoucherDto[]> =>
    apiClient.get<VoucherDto[]>(BASE),

  upsert: (payload: UpsertVoucherPayload): Promise<VoucherDto> =>
    apiClient.put<VoucherDto>(BASE, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),

  /** Validate a voucher code against a cart subtotal — preview only, does not consume. */
  validate: (code: string, subtotal: number): Promise<VoucherValidationDto> =>
    apiClient.post<VoucherValidationDto>(`${BASE}/validate`, { code, subtotal }),

  /** Validate AND consume a voucher (increments usage). */
  redeem: (code: string, subtotal: number): Promise<VoucherValidationDto> =>
    apiClient.post<VoucherValidationDto>(`${BASE}/redeem`, { code, subtotal }),
};
