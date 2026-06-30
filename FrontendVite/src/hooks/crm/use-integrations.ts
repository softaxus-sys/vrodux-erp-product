import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { integrationsApi, type UpdateConfigRequest, type MetaPageSelection } from "@/lib/crm/integrations.api";

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
