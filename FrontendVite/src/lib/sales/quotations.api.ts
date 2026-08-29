import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE          = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/quotations`;
const TEMPLATE_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/quotation-templates`;
const PUBLIC_BASE   = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/public/quotations`;

// ── Status ────────────────────────────────────────────────────────────────────
// Unchanged from the original vocabulary, with "viewed" added — "approved"/"rejected" already
// meant accepted/declined, so renaming them would have meant migrating every stored row.
export type QuotationStatus =
  | "draft" | "sent" | "viewed" | "approved" | "rejected" | "converted" | "expired";

export const QUOTATION_STATUS_META: Record<QuotationStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: "Draft",     color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  sent:      { label: "Sent",      color: "text-primary",     bg: "bg-primary/10",                     dot: "bg-primary" },
  viewed:    { label: "Viewed",    color: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-900/30", dot: "bg-violet-500" },
  approved:  { label: "Accepted",  color: "text-success",     bg: "bg-success/10",                     dot: "bg-success" },
  rejected:  { label: "Declined",  color: "text-destructive", bg: "bg-destructive/10",                 dot: "bg-destructive" },
  converted: { label: "Converted", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", dot: "bg-emerald-500" },
  expired:   { label: "Expired",   color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-900/30", dot: "bg-amber-500" },
};

/** A quotation still open to editing — anything else needs duplicating into a revision. */
export const isEditableQuotation = (s: QuotationStatus) =>
  s === "draft" || s === "sent" || s === "viewed" || s === "expired";

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface QuotationSectionDto {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface QuotationItemDto {
  id: string;
  sectionId: string | null;
  productId: string | null;
  description: string;
  unit: string | null;
  notes: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  isOptional: boolean;
  sortOrder: number;
  lineTotal: number;
}

export interface QuotationSummaryDto {
  id: string;
  quotationNumber: string;
  title: string | null;
  customerId: string | null;
  customerName: string | null;
  status: QuotationStatus;
  currencyCode: string;
  discountPercent: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  issueDate: string | null;
  validUntil: string | null;
  isExpired: boolean;
  convertedOrderId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  hasShareLink: boolean;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface QuotationDto {
  id: string;
  quotationNumber: string;
  title: string | null;
  reference: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  status: QuotationStatus;
  currencyCode: string;
  issueDate: string | null;
  validUntil: string | null;
  isExpired: boolean;
  coverNote: string | null;
  termsAndConditions: string | null;
  paymentTerms: string | null;
  notes: string | null;
  preparedByName: string | null;
  customFields: Record<string, string> | null;
  discountPercent: number;
  subTotal: number;
  discountAmount: number;
  netSubTotal: number;
  taxAmount: number;
  total: number;
  optionalTotal: number;
  sections: QuotationSectionDto[];
  items: QuotationItemDto[];
  shareToken: string | null;
  sentAt: string | null;
  sentTo: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  respondedByName: string | null;
  responseComment: string | null;
  convertedOrderId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface QuotationBrandingDto {
  companyName: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  logoUrl: string | null;
  accentColor: string | null;
}

/** What the anonymous public page receives — a strict subset of {@link QuotationDto}. */
export interface PublicQuotationDto {
  quotationNumber: string;
  title: string | null;
  reference: string | null;
  customerName: string | null;
  status: QuotationStatus;
  currencyCode: string;
  issueDate: string | null;
  validUntil: string | null;
  isExpired: boolean;
  canRespond: boolean;
  coverNote: string | null;
  termsAndConditions: string | null;
  paymentTerms: string | null;
  preparedByName: string | null;
  customFields: Record<string, string> | null;
  discountPercent: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  optionalTotal: number;
  sections: QuotationSectionDto[];
  items: QuotationItemDto[];
  respondedAt: string | null;
  responseComment: string | null;
  branding: QuotationBrandingDto;
}

export interface QuotationShareLinkDto { token: string; url: string }
export interface QuotationSendResultDto {
  emailSent: boolean;
  sentTo: string | null;
  url: string;
  warning: string | null;
}
export interface ConvertQuotationResultDto { orderId: string; orderNumber: string }

// ── Templates ─────────────────────────────────────────────────────────────────
export interface QuotationTemplateItemDto {
  id?: string;
  description: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  sectionTitle: string | null;
  isOptional: boolean;
  sortOrder: number;
}

export interface QuotationTemplateDto {
  id: string;
  name: string;
  description: string | null;
  titleTemplate: string | null;
  coverNote: string | null;
  termsAndConditions: string | null;
  paymentTerms: string | null;
  footerNote: string | null;
  validityDays: number;
  defaultTaxRate: number;
  defaultDiscount: number;
  accentColor: string | null;
  showLogo: boolean;
  customFields: Record<string, string> | null;
  isDefault: boolean;
  isActive: boolean;
  items: QuotationTemplateItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

// ── Requests ──────────────────────────────────────────────────────────────────
export interface QuotationSectionRequest {
  /** The builder's own id, used to tie lines to a section that does not exist server-side yet. */
  clientId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
}

export interface QuotationItemRequest {
  productId?: string | null;
  description: string;
  unit?: string | null;
  notes?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  sectionClientId?: string | null;
  isOptional: boolean;
  sortOrder: number;
}

export interface QuotationDocumentRequest {
  title?: string | null;
  reference?: string | null;
  issueDate?: string | null;
  coverNote?: string | null;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  preparedByName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customFields?: Record<string, string> | null;
}

export interface CreateQuotationRequest {
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  discountPercent: number;
  items: QuotationItemRequest[];
  sections?: QuotationSectionRequest[] | null;
  document?: QuotationDocumentRequest | null;
  templateId?: string | null;
}

export interface UpdateQuotationRequest extends Omit<CreateQuotationRequest, "templateId"> {
  status: QuotationStatus;
}

export interface GetQuotationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  customerId?: string;
  invoiceId?: string;
}

export interface SaveQuotationTemplateRequest {
  name: string;
  description?: string | null;
  titleTemplate?: string | null;
  coverNote?: string | null;
  termsAndConditions?: string | null;
  paymentTerms?: string | null;
  footerNote?: string | null;
  validityDays: number;
  defaultTaxRate: number;
  defaultDiscount: number;
  accentColor?: string | null;
  showLogo: boolean;
  customFields?: Record<string, string> | null;
  isDefault: boolean;
  isActive?: boolean;
  items: Omit<QuotationTemplateItemDto, "id">[];
}

// ── Client ────────────────────────────────────────────────────────────────────
export const quotationsApi = {
  getAll: (params: GetQuotationsParams = {}): Promise<PagedResult<QuotationSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.search)     qs.set("search",     params.search);
    if (params.status)     qs.set("status",     params.status);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.invoiceId)  qs.set("invoiceId",  params.invoiceId);
    return rawApiClient.get(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<QuotationDto> => rawApiClient.get(`${BASE}/${id}`),

  create: (payload: CreateQuotationRequest): Promise<QuotationDto> =>
    rawApiClient.post(BASE, payload),

  update: (id: string, payload: UpdateQuotationRequest): Promise<QuotationDto> =>
    rawApiClient.put(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/${id}`),

  duplicate: (id: string): Promise<QuotationDto> =>
    rawApiClient.post(`${BASE}/${id}/duplicate`),

  send: (id: string, body: { toEmail?: string | null; message?: string | null; sendEmail?: boolean }):
    Promise<QuotationSendResultDto> => rawApiClient.post(`${BASE}/${id}/send`, body),

  createShareLink: (id: string): Promise<QuotationShareLinkDto> =>
    rawApiClient.post(`${BASE}/${id}/share-link`),

  revokeShareLink: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/${id}/share-link`),

  respond: (id: string, body: { accepted: boolean; byName?: string | null; comment?: string | null }):
    Promise<QuotationDto> => rawApiClient.post(`${BASE}/${id}/respond`, body),

  convertToOrder: (id: string): Promise<ConvertQuotationResultDto> =>
    rawApiClient.post(`${BASE}/${id}/convert`),

  /** Attach (or, with a null id, detach) the Finance invoice this quotation is billed under. */
  linkInvoice: (id: string, body: { invoiceId: string | null; invoiceNumber: string | null }):
    Promise<QuotationDto> => rawApiClient.patch(`${BASE}/${id}/invoice`, body),

  // ── Templates ──
  getTemplates: (includeInactive = false): Promise<QuotationTemplateDto[]> =>
    rawApiClient.get(`${TEMPLATE_BASE}?includeInactive=${includeInactive}`),

  getTemplate: (id: string): Promise<QuotationTemplateDto> =>
    rawApiClient.get(`${TEMPLATE_BASE}/${id}`),

  createTemplate: (payload: SaveQuotationTemplateRequest): Promise<QuotationTemplateDto> =>
    rawApiClient.post(TEMPLATE_BASE, payload),

  updateTemplate: (id: string, payload: SaveQuotationTemplateRequest): Promise<QuotationTemplateDto> =>
    rawApiClient.put(`${TEMPLATE_BASE}/${id}`, { isActive: true, ...payload }),

  deleteTemplate: (id: string): Promise<void> =>
    rawApiClient.delete(`${TEMPLATE_BASE}/${id}`),
};

/**
 * The anonymous customer-facing endpoints. These deliberately use `fetch` rather than
 * `rawApiClient`: the public page is reached without signing in, and the shared client attaches
 * the stored access token and redirects to /login on a 401 — which would bounce a customer who
 * has no account out of the quotation they were sent.
 */
export const publicQuotationsApi = {
  get: async (token: string): Promise<PublicQuotationDto> => {
    const res = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  respond: async (
    token: string,
    body: { accepted: boolean; byName?: string | null; comment?: string | null },
  ): Promise<PublicQuotationDto> => {
    const res = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(token)}/respond`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },
};

/** Mirrors rawApiClient's error extraction — the API is not consistent about which key it uses. */
async function extractError(res: Response): Promise<string> {
  try {
    const b = await res.json();
    return b?.description ?? b?.detail ?? b?.message ?? b?.error ?? `HTTP ${res.status}`;
  } catch {
    return res.status === 404
      ? "This quotation link is not valid, or it has been withdrawn."
      : `HTTP ${res.status}`;
  }
}
