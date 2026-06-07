import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/journal-entries`;

export interface JournalLineDto {
  id: string;
  accountId: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
}

export interface JournalEntrySummaryDto {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface JournalEntryDto extends Omit<JournalEntrySummaryDto, "lineCount"> {
  notes: string | null;
  isBalanced: boolean;
  lines: JournalLineDto[];
}

export interface LineRequest {
  accountId: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
}

export interface CreateJournalEntryRequest {
  date: string;
  description: string;
  reference?: string | null;
  notes?: string | null;
  lines: LineRequest[];
}

export interface GetJournalEntriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const journalEntriesApi = {
  getAll: (params: GetJournalEntriesParams = {}): Promise<PagedResult<JournalEntrySummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.status)   qs.set("status",   params.status);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo)   qs.set("dateTo",   params.dateTo);
    return rawApiClient.get<PagedResult<JournalEntrySummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<JournalEntryDto> =>
    rawApiClient.get<JournalEntryDto>(`${BASE}/${id}`),

  create: (data: CreateJournalEntryRequest): Promise<JournalEntryDto> =>
    rawApiClient.post<JournalEntryDto>(BASE, data),

  post: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/post`),

  void: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/void`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
