import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/pos-dashboard`;

/**
 * Gross = completed sales + sales later refunded (a refund voids its original sale, so leaving those
 * out would count the refund twice). Net = gross − refunds. Voids are sales cancelled outright.
 */
export interface PosKpisDto {
  grossSales: number;
  refunds: number;
  netSales: number;
  transactions: number;
  refundCount: number;
  voidCount: number;
  voidedValue: number;
  averageBasket: number;
  itemsSold: number;
  discounts: number;
  tax: number;
}

export interface PosTrendPointDto { bucket: string; sales: number; refunds: number; transactions: number; }
export interface PosPaymentMixDto { method: string; amount: number; count: number; }
export interface PosTopProductDto { productId: string; name: string; quantity: number; revenue: number; }
export interface PosCashierDto { cashierId: string; transactions: number; sales: number; }
export interface PosOpenShiftDto {
  sessionId: string; registerId: string; cashierId: string; openedAt: string;
  transactions: number; netSales: number; isOffline: boolean;
}
export interface PosTillBacklogDto {
  deviceId: string; registerId: string | null; userName: string | null;
  pendingRecords: number; unsyncedShifts: number; reportedAt: string;
}

export interface PosOverviewDto {
  from: string;
  to: string;
  hourly: boolean;
  current: PosKpisDto;
  previous: PosKpisDto;
  trend: PosTrendPointDto[];
  paymentMix: PosPaymentMixDto[];
  topProducts: PosTopProductDto[];
  cashiers: PosCashierDto[];
  openShifts: PosOpenShiftDto[];
  offlineModeEnabled: boolean;
  tillsWithUnsyncedWork: PosTillBacklogDto[];
}

export const posDashboardApi = {
  /** `from`/`to` are local calendar days (yyyy-MM-dd); the offset lets the server bucket on the till's clock. */
  getOverview: (from: string, to: string): Promise<PosOverviewDto> => {
    const utcOffsetMinutes = -new Date().getTimezoneOffset();
    const qs = new URLSearchParams({ from, to, utcOffsetMinutes: String(utcOffsetMinutes) });
    return apiClient.get<PosOverviewDto>(`${BASE}/overview?${qs}`);
  },
};
