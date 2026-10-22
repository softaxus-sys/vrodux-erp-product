import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/finance/invoices`;

export type EInvoiceOutcome = "sending" | "accepted" | "rejected" | "failed" | "not_configured";

export interface EInvoiceIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface EInvoiceSubmissionDto {
  id: string;
  status: EInvoiceOutcome;
  provider: string;
  environment: string;
  providerMessageId: string | null;
  httpStatus: number | null;
  message: string | null;
  submittedByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface EInvoiceStatusDto {
  invoiceId: string;
  invoiceNumber: string;
  gatewayConfigured: boolean;
  provider: string;
  environment: string;
  xml: string | null;
  issues: EInvoiceIssue[];
  canSubmit: boolean;
  submissions: EInvoiceSubmissionDto[];
}

export const einvoiceApi = {
  getStatus: (invoiceId: string): Promise<EInvoiceStatusDto> =>
    rawApiClient.get(`${BASE}/${invoiceId}/einvoice`),

  submit: (invoiceId: string): Promise<EInvoiceSubmissionDto> =>
    rawApiClient.post(`${BASE}/${invoiceId}/einvoice/submit`, {}),
};
