import { apiClient } from "@/lib/api-client";
import type { CrmDocumentDto, CrmDocumentTarget } from "@/types/file-manager";

const BASE = "/api/crm/documents";

/** Gates whether the File Manager *tab* opens at all -- what it can actually list is a separate
 *  question (CRM_LEADS_VIEW / CRM_PIPELINE_VIEW / CRM_CUSTOMERS_VIEW below), same split Module 35
 *  fixed on web: a user with file-manager.view and no CRM permission still opens the screen, they
 *  just see "no libraries available" rather than a permission error. `.export` gates nothing here
 *  yet -- there's no download/export built (see the top-of-screen note), so it isn't imported. */
export const FILE_MANAGER_VIEW = "file-manager.view";

export interface DocumentLibraryFilters {
  search?: string;
  documentType?: string;
  relatedToType?: CrmDocumentTarget;
}

export const fileManagerApi = {
  /** Tenant-wide library across every CRM record, already owner-scoped server-side (an
   *  assigned-only rep gets only their own; a team lead their team's; an admin everything). */
  search: (f: DocumentLibraryFilters = {}): Promise<CrmDocumentDto[]> => {
    const qs = new URLSearchParams();
    if (f.search?.trim()) qs.set("search", f.search.trim());
    if (f.documentType) qs.set("documentType", f.documentType);
    if (f.relatedToType) qs.set("relatedToType", f.relatedToType);
    const q = qs.toString();
    return apiClient.get(`${BASE}/library${q ? `?${q}` : ""}`);
  },
};
