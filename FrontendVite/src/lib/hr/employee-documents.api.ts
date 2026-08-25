import { rawApiClient } from "@/lib/api-client";

// Must carry the API root like every other client module: a bare relative path hits the Vite dev
// server (5173) instead of the backend, which answers 404 for anything it does not serve itself.
const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = (employeeId: string) => `${API_ROOT}/api/hr/employees/${employeeId}/documents`;

/** Metadata only — the API never returns file bytes in a list. */
export interface EmployeeDocumentDto {
  id: string;
  employeeId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  documentType: string;
  description?: string | null;
  /** yyyy-MM-dd. Passports, visas and insurance expire; HR needs to see what is lapsing. */
  expiryDate?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

export const EMPLOYEE_DOCUMENT_TYPES = [
  "passport", "visa", "emirates_id", "contract", "certificate", "insurance", "other",
] as const;

export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

/** Types where an expiry date is the point of storing the document. */
export const EXPIRING_DOCUMENT_TYPES = new Set<string>(["passport", "visa", "emirates_id", "insurance"]);

export const employeeDocumentsApi = {
  getAll: (employeeId: string): Promise<EmployeeDocumentDto[]> =>
    rawApiClient.get(BASE(employeeId)),

  upload: (params: {
    employeeId: string;
    file: File;
    documentType: string;
    description?: string;
    expiryDate?: string;
  }): Promise<EmployeeDocumentDto> => {
    const form = new FormData();
    form.append("documentType", params.documentType);
    if (params.description) form.append("description", params.description);
    if (params.expiryDate)  form.append("expiryDate", params.expiryDate);
    form.append("file", params.file);
    return rawApiClient.postForm(BASE(params.employeeId), form);
  },

  remove: (employeeId: string, documentId: string): Promise<void> =>
    rawApiClient.delete(`${BASE(employeeId)}/${documentId}`),

  /** Fetches with the bearer token, then triggers a browser save. */
  download: async (doc: EmployeeDocumentDto): Promise<void> => {
    const { blob, fileName } = await rawApiClient.getBlob(
      `${BASE(doc.employeeId)}/${doc.id}/content`
    );
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};
