import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import type { ReportResult, ReportRunParams } from "@/lib/pos/reports.api";
import { localToday } from "./library.api";

const BASE = `${getApiBaseUrl()}/api/library`;

export interface UnpostedPaymentDto {
  id: string; paidOn: string; memberName: string; memberNumber: string; fineType: string; title: string | null;
  method: string; amount: number;
}
export interface AmountByKeyDto { key: string; amount: number; count: number }

/** Fine payments taken up to a date that are not in the accounts yet. */
export interface FinePostingPreviewDto {
  total: number; count: number; from: string | null; to: string | null;
  byMethod: AmountByKeyDto[]; byType: AmountByKeyDto[]; payments: UnpostedPaymentDto[];
}
export interface FinePostingResultDto { payments: number; amount: number; journalEntryNumber: string | null }
export interface FinePostingHistoryDto {
  journalEntryId: string; journalEntryNumber: string | null; postedAt: string; amount: number; payments: number;
  from: string; to: string;
}

export const libraryReportsApi = {
  /** Run a hub report by its registry id. Sends the desk's own date so "overdue" is judged locally. */
  run: (reportId: string, params: ReportRunParams = {}): Promise<ReportResult> => {
    const qs = new URLSearchParams({ today: localToday() });
    if (params.from) qs.set("from", params.from);
    if (params.to)   qs.set("to", params.to);
    return rawApiClient.get(`${BASE}/reports/run/${encodeURIComponent(reportId)}?${qs}`);
  },

  getUnposted: (through: string): Promise<FinePostingPreviewDto> =>
    rawApiClient.get(`${BASE}/fines/finance/unposted?${new URLSearchParams({ through, today: localToday() })}`),
  getHistory: (): Promise<FinePostingHistoryDto[]> => rawApiClient.get(`${BASE}/fines/finance/history`),
  markPosted: (body: { paymentIds: string[]; journalEntryId: string; journalEntryNumber: string | null }): Promise<FinePostingResultDto> =>
    rawApiClient.post(`${BASE}/fines/finance/posted`, body),
};
