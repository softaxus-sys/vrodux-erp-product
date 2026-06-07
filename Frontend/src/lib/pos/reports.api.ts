import { apiClient } from "@/lib/api-client";
import type { DailySummaryDto } from "./types";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/reports`;

export const reportsApi = {
  getDailySummary: (params: {
    date?: string;
    sessionId?: string;
  } = {}): Promise<DailySummaryDto> => {
    const qs = new URLSearchParams();
    if (params.date)      qs.set("date",      params.date);
    if (params.sessionId) qs.set("sessionId", params.sessionId);
    return apiClient.get<DailySummaryDto>(`${BASE}/daily-summary?${qs}`);
  },
};
