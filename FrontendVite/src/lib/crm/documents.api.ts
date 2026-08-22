import { rawApiClient } from "@/lib/api-client";
import i18n from "@/i18n";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API_ROOT}/api/crm/documents`;

/** Which CRM record a document hangs off. Mirrors CrmDocumentTargets on the backend. */
export type CrmDocumentTarget = "lead" | "deal" | "customer" | "contact";

export interface CrmDocumentDto {
  id: string;
  relatedToType: CrmDocumentTarget;
  relatedToId: string;
  relatedToName: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  documentType: string;
  description: string | null;
  uploadedByName: string | null;
  createdAt: string;
  /**
   * Owner of the linked record — the rep whose lead/opportunity/account this is, NOT whoever
   * uploaded the file. The File Manager groups folders by this so a manager uploading onto a rep's
   * deal still files under that rep. Null when the linked record is unassigned.
   */
  ownerUserId: string | null;
  ownerName: string | null;
}

/**
 * Suggested categories. The backend accepts any string (max 40 chars) so tenants aren't boxed in —
 * these are just the options offered in the picker.
 */
export const DOCUMENT_TYPES = [
  "contract",
  "proposal",
  "quotation",
  "agreement",
  "invoice",
  "id_document",
  "trade_license",
  "presentation",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Translated label for a category, falling back to the raw value for tenant-defined ones. */
export const documentTypeLabel = (value: string) =>
  i18n.t(`crm:documents.type.${value}`, {
    defaultValue: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  });

/** Human-readable size, e.g. "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Matches UploadCrmDocumentCommandValidator.MaxBytes on the backend. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** True when the browser can display this inline rather than only saving it. */
export const isPreviewable = (contentType: string) =>
  contentType.startsWith("image/") || contentType === "application/pdf";

export interface DocumentLibraryFilters {
  search?: string;
  documentType?: string;
  relatedToType?: CrmDocumentTarget;
}

export const crmDocumentsApi = {
  getAll: (relatedToType: CrmDocumentTarget, relatedToId: string): Promise<CrmDocumentDto[]> =>
    rawApiClient.get(`${BASE}?relatedToType=${relatedToType}&relatedToId=${relatedToId}`),

  /** Tenant-wide library across every CRM record. */
  search: (f: DocumentLibraryFilters = {}): Promise<CrmDocumentDto[]> => {
    const qs = new URLSearchParams();
    if (f.search?.trim())   qs.set("search", f.search.trim());
    if (f.documentType)     qs.set("documentType", f.documentType);
    if (f.relatedToType)    qs.set("relatedToType", f.relatedToType);
    const q = qs.toString();
    return rawApiClient.get(`${BASE}/library${q ? `?${q}` : ""}`);
  },

  /**
   * Object URL for inline preview. The caller MUST revoke it when done, or the blob leaks for the
   * lifetime of the page.
   */
  previewUrl: async (doc: CrmDocumentDto): Promise<string> => {
    const { blob } = await rawApiClient.getBlob(`${BASE}/${doc.id}/content`);
    return URL.createObjectURL(blob);
  },

  upload: (params: {
    relatedToType: CrmDocumentTarget;
    relatedToId: string;
    file: File;
    documentType: string;
    description?: string;
  }): Promise<CrmDocumentDto> => {
    const form = new FormData();
    form.append("relatedToType", params.relatedToType);
    form.append("relatedToId", params.relatedToId);
    form.append("documentType", params.documentType);
    if (params.description) form.append("description", params.description);
    form.append("file", params.file);
    return rawApiClient.postForm(BASE, form);
  },

  update: (id: string, body: { documentType: string; description?: string | null }): Promise<CrmDocumentDto> =>
    rawApiClient.put(`${BASE}/${id}`, body),

  remove: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/${id}`),

  /** Fetches with the bearer token and triggers a browser save. */
  download: async (doc: CrmDocumentDto): Promise<void> => {
    const { blob, fileName } = await rawApiClient.getBlob(`${BASE}/${doc.id}/content`);
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Revoke on the next tick — revoking synchronously can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
};
