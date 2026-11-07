import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/finance/einvoicing`;

export type EInvoiceDocType = "invoice" | "credit-note";

export interface EInvoiceSettingsDto {
  providerKey: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  goLiveDate: string | null;
  legalIdScheme: string | null;
  legalId: string | null;
  registrationAuthority: string | null;
  supplierCity: string | null;
  providerAvailable: boolean;
  providerUnavailableReason: string | null;
  supplierTrn: string;
  supplierName: string;
}

export type UpdateEInvoiceSettings = Omit<EInvoiceSettingsDto,
  "providerAvailable" | "providerUnavailableReason" | "supplierTrn" | "supplierName">;

export interface EInvoiceIssueDto { severity: "error" | "warning"; code: string; message: string }

export interface EInvoiceCheckDto {
  documentType: string; documentId: string; documentNumber: string;
  ready: boolean; errors: number; warnings: number; issues: EInvoiceIssueDto[];
}

export type EInvoiceStatus =
  "queued" | "sending" | "sent" | "delivered" | "accepted" | "rejected" | "failed" | "cancelled" | "blocked";

export interface EInvoiceSubmissionDto {
  id: string; documentType: string; documentId: string; documentNumber: string; providerKey: string;
  status: EInvoiceStatus; attempts: number; nextAttemptAt: string | null; externalId: string | null;
  lastError: string | null; hasXml: boolean; createdAt: string; sentAt: string | null;
}

export interface EInvoiceReadinessDto {
  invoicesChecked: number; invoicesReady: number; invoicesBlocked: number;
  customersChecked: number; customersMissingTrn: number; customersMissingAddress: number; customersMissingEmirate: number;
  supplierReady: boolean; supplierIssues: EInvoiceIssueDto[];
  problems: { kind: string; id: string | null; name: string; problem: string }[];
  totals: { code: string; message: string; count: number }[];
  submissionsQueued: number; submissionsFailed: number; submissionsSent: number;
}

export interface CreditNoteItemDto {
  id: string; description: string; quantity: number; unitPrice: number; lineTotal: number;
  taxCategory: string | null; unitCode: string | null; exemptionReason: string | null;
}

export interface CreditNoteDto {
  id: string; creditNoteNumber: string; invoiceId: string; invoiceNumber: string; customerName: string;
  creditDate: string; taxRate: number; currencyCode: string; reason: string; notes: string | null;
  status: "draft" | "issued" | "cancelled"; subTotal: number; taxAmount: number; total: number;
  eInvoiceStatus: EInvoiceStatus | null; items: CreditNoteItemDto[];
}

export interface CreditNoteSummaryDto {
  id: string; creditNoteNumber: string; invoiceId: string; invoiceNumber: string; customerName: string;
  creditDate: string; currencyCode: string; reason: string; status: "draft" | "issued" | "cancelled";
  total: number; eInvoiceStatus: EInvoiceStatus | null;
}

export interface CreateCreditNoteRequest {
  invoiceId: string;
  reason: string;
  creditDate?: string;
  notes?: string;
  /** Omit to credit the whole invoice, line for line. */
  items?: { description: string; quantity: number; unitPrice: number; taxCategory?: string | null; unitCode?: string | null; exemptionReason?: string | null }[];
}

async function saveBlob(url: string, fallbackName: string) {
  const { blob, fileName } = await rawApiClient.getBlob(url);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href; a.download = fileName ?? fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const einvoicingApi = {
  getSettings: (): Promise<EInvoiceSettingsDto> => rawApiClient.get(`${BASE}/settings`),
  updateSettings: (body: UpdateEInvoiceSettings): Promise<EInvoiceSettingsDto> => rawApiClient.put(`${BASE}/settings`, body),
  getReadiness: (): Promise<EInvoiceReadinessDto> => rawApiClient.get(`${BASE}/readiness`),
  check: (type: EInvoiceDocType, id: string): Promise<EInvoiceCheckDto> => rawApiClient.get(`${BASE}/${type}/${id}/check`),
  downloadXml: (type: EInvoiceDocType, id: string, name: string) => saveBlob(`${BASE}/${type}/${id}/xml`, `${name}.xml`),
  queue: (type: EInvoiceDocType, id: string): Promise<EInvoiceSubmissionDto> => rawApiClient.post(`${BASE}/${type}/${id}/queue`),
  getSubmissions: (p: { status?: string; documentId?: string; page?: number } = {}): Promise<{ total: number; items: EInvoiceSubmissionDto[] }> => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (p.documentId) q.set("documentId", p.documentId);
    if (p.page) q.set("page", String(p.page));
    const s = q.toString();
    return rawApiClient.get(`${BASE}/submissions${s ? `?${s}` : ""}`);
  },
  retry: (id: string): Promise<EInvoiceSubmissionDto> => rawApiClient.post(`${BASE}/submissions/${id}/retry`),

  getCreditNotes: (p: { invoiceId?: string; status?: string } = {}): Promise<CreditNoteSummaryDto[]> => {
    const q = new URLSearchParams();
    if (p.invoiceId) q.set("invoiceId", p.invoiceId);
    if (p.status) q.set("status", p.status);
    const s = q.toString();
    return rawApiClient.get(`${BASE}/credit-notes${s ? `?${s}` : ""}`);
  },
  getCreditNote: (id: string): Promise<CreditNoteDto> => rawApiClient.get(`${BASE}/credit-notes/${id}`),
  createCreditNote: (body: CreateCreditNoteRequest): Promise<CreditNoteDto> => rawApiClient.post(`${BASE}/credit-notes`, body),
  issueCreditNote: (id: string): Promise<CreditNoteDto> => rawApiClient.post(`${BASE}/credit-notes/${id}/issue`),
  cancelCreditNote: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/credit-notes/${id}`),
};
