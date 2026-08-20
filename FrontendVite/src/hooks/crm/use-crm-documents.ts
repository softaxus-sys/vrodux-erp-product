import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { crmDocumentsApi } from "@/lib/crm/documents.api";
import type { CrmDocumentDto, CrmDocumentTarget, DocumentLibraryFilters } from "@/lib/crm/documents.api";

const QK = "crm";

const t = (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
  i18n.t(`crm:${key}`, { defaultValue, ...opts });

/** Documents attached to one CRM record. */
export function useCrmDocuments(
  relatedToType: CrmDocumentTarget,
  relatedToId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: [QK, "documents", relatedToType, relatedToId],
    queryFn:  () => crmDocumentsApi.getAll(relatedToType, relatedToId!),
    enabled:  enabled && !!relatedToId,
    staleTime: 60 * 1000,
  });
}

/** Tenant-wide document library, with optional filters. */
export function useCrmDocumentLibrary(filters: DocumentLibraryFilters, enabled = true) {
  return useQuery({
    queryKey: [QK, "documents", "library", filters.search ?? "", filters.documentType ?? "", filters.relatedToType ?? ""],
    queryFn:  () => crmDocumentsApi.search(filters),
    staleTime: 30 * 1000,
    enabled,
  });
}

function useDocumentMutation<TArgs>(
  fn: (args: TArgs) => Promise<unknown>,
  successMessage: () => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "documents"] });
      toast.success(successMessage());
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadCrmDocument() {
  return useDocumentMutation(
    crmDocumentsApi.upload,
    () => t("documents.uploaded", "Document uploaded."),
  );
}

export function useUpdateCrmDocument() {
  return useDocumentMutation(
    ({ id, ...body }: { id: string; documentType: string; description?: string | null }) =>
      crmDocumentsApi.update(id, body),
    () => t("documents.updated", "Document updated."),
  );
}

export function useDeleteCrmDocument() {
  return useDocumentMutation(
    (id: string) => crmDocumentsApi.remove(id),
    () => t("documents.deleted", "Document deleted."),
  );
}

/**
 * Download is not a mutation — it doesn't change server state, so it doesn't invalidate anything.
 * It still needs its own error toast because the fetch can fail (expired session, deleted file).
 */
export function useDownloadCrmDocument() {
  return useMutation({
    mutationFn: (doc: CrmDocumentDto) => crmDocumentsApi.download(doc),
    onError: (e: Error) => toast.error(e.message),
  });
}
