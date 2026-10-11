import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import type { ReportResult, ReportRunParams } from "@/lib/pos/reports.api";
import { localToday } from "./trade.api";

const BASE = `${getApiBaseUrl()}/api/trade`;

export const tradeReportsApi = {
  /** Run a hub report by its registry id. Sends the user's own date so "late" and "expiring" are judged locally. */
  run: (reportId: string, params: ReportRunParams = {}): Promise<ReportResult> => {
    const qs = new URLSearchParams({ today: localToday() });
    if (params.from) qs.set("from", params.from);
    if (params.to)   qs.set("to", params.to);
    return rawApiClient.get(`${BASE}/reports/run/${encodeURIComponent(reportId)}?${qs}`);
  },
};
