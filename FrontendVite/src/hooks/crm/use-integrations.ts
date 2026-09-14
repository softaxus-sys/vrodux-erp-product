import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { integrationsApi, type UpdateConfigRequest, type MetaPageSelection, type LeadInboxFilters } from "@/lib/crm/integrations.api";

const QK = "crm-integrations";

export function useProviderCatalog() {
  return useQuery({
    queryKey: [QK, "catalog"],
    queryFn:  integrationsApi.getCatalog,
    staleTime: 30 * 1000,
  });
}

export function useIntegration(id: string | null) {
  return useQuery({
    queryKey: [QK, "detail", id],
    queryFn:  () => integrationsApi.getById(id!),
    enabled:  !!id,
    staleTime: 15 * 1000,
  });
}

export function useIntegrationSyncLogs(id: string | null) {
  return useQuery({
    queryKey: [QK, "sync-logs", id],
    queryFn:  () => integrationsApi.getSyncLogs(id!),
    enabled:  !!id,
    staleTime: 15 * 1000,
  });
}

export function useIntegrationInbox(id: string | null, status?: string) {
  return useQuery({
    queryKey: [QK, "inbox", id, status ?? "all"],
    queryFn:  () => integrationsApi.getInbox(id!, status),
    enabled:  !!id,
    staleTime: 15 * 1000,
  });
}

// ── Lead Inbox ───────────────────────────────────────────────────────────────

/**
 * Deliveries are written by a background processor, not by anything this page does, so the list
 * polls: without it a row sits at "pending" on screen long after it has become a lead. 15s is
 * slow enough to be cheap and fast enough that a webhook lands while someone is watching for it.
 */
export function useLeadInbox(filters: LeadInboxFilters) {
  return useQuery({
    // Keyed on the filter values, not the object, so a re-render with an equivalent object does
    // not miss the cache.
    queryKey: [QK, "lead-inbox", filters.page ?? 1, filters.pageSize ?? 25,
               filters.provider ?? "all", filters.status ?? "all", filters.search ?? ""],
    queryFn:  () => integrationsApi.getLeadInbox(filters),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    placeholderData: prev => prev,   // paging must not blank the table
  });
}

export function useLeadInboxSummary() {
  return useQuery({
    queryKey: [QK, "lead-inbox-summary"],
    queryFn:  integrationsApi.getLeadInboxSummary,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useLeadInboxEntry(entryId: string | null) {
  return useQuery({
    queryKey: [QK, "lead-inbox-entry", entryId],
    queryFn:  () => integrationsApi.getLeadInboxEntry(entryId!),
    enabled:  !!entryId,
    staleTime: 15 * 1000,
  });
}

export function useRetryLeadInboxEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => integrationsApi.retryLeadInboxEntry(entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "lead-inbox"] });
      qc.invalidateQueries({ queryKey: [QK, "lead-inbox-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "lead-inbox-entry"] });
      // Queued, not done: the processor picks it up on its next pass, so promising a lead here
      // would be a claim this call cannot make.
      toast.success("Queued for reprocessing.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [QK, "catalog"] });
    qc.invalidateQueries({ queryKey: [QK, "detail"] });
  };
}

export function useCreateIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ providerKey, name }: { providerKey: string; name?: string }) =>
      integrationsApi.create(providerKey, name),
    onSuccess: () => { invalidate(); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useUpdateIntegrationConfig() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateConfigRequest }) =>
      integrationsApi.updateConfig(id, req),
    onSuccess: () => { invalidate(); toast.success("Integration settings saved."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useSetIntegrationApiKey() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, apiKey }: { id: string; apiKey: string }) => integrationsApi.setApiKey(id, apiKey),
    onSuccess: () => { invalidate(); toast.success("API key saved."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useSetIntegrationSigningSecret() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, secret }: { id: string; secret: string }) => integrationsApi.setSigningSecret(id, secret),
    onSuccess: () => { invalidate(); toast.success("Signing secret saved."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useBackfillIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, since }: { id: string; since: string }) => integrationsApi.backfill(id, since),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Imported ${r.created} lead(s); ${r.duplicates} already present.`);
      if (r.note) toast.info(r.note);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRotateInboundKey() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.rotateKey(id),
    onSuccess: () => { invalidate(); toast.success("Inbound key rotated."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.disconnect(id),
    onSuccess: () => { invalidate(); toast.success("Integration disconnected."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIntegration() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.remove(id),
    onSuccess: () => { invalidate(); toast.success("Integration removed."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useStartMetaOAuth() {
  return useMutation({
    mutationFn: (id: string) => integrationsApi.meta.oauthStart(id),
    onError:    (e: Error) => toast.error(e.message),
  });
}

export function useMetaPages(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [QK, "meta-pages", id],
    queryFn:  () => integrationsApi.meta.pages(id!),
    enabled:  !!id && enabled,
  });
}

export function useSelectMetaTargets() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, pages }: { id: string; pages: MetaPageSelection[] }) =>
      integrationsApi.meta.select(id, pages),
    onSuccess: () => { invalidate(); toast.success("Facebook pages connected."); },
    onError:   (e: Error) => toast.error(e.message),
  });
}
