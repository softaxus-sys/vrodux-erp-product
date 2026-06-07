import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/invoices`;

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceSummaryDto {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  subTotal: number;
  taxAmount: number;
  total: number;
  status: string;
  itemCount: number;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface InvoiceDto extends Omit<InvoiceSummaryDto, "itemCount"> {
  notes: string | null;
  items: InvoiceItemDto[];
}

export interface InvoiceItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceRequest {
  customerName: string;
  customerEmail?: string | null;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  notes?: string | null;
  items: InvoiceItemRequest[];
}

export interface UpdateInvoiceRequest extends CreateInvoiceRequest {
  status: string;
}

export interface GetInvoicesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export const invoicesApi = {
  getAll: (params: GetInvoicesParams = {}): Promise<PagedResult<InvoiceSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.status)   qs.set("status",   params.status);
    return rawApiClient.get<PagedResult<InvoiceSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<InvoiceDto> =>
    rawApiClient.get<InvoiceDto>(`${BASE}/${id}`),

  create: (data: CreateInvoiceRequest): Promise<InvoiceDto> =>
    rawApiClient.post<InvoiceDto>(BASE, data),

  update: (id: string, data: UpdateInvoiceRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  markPaid: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/pay`),

  cancel: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/cancel`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
