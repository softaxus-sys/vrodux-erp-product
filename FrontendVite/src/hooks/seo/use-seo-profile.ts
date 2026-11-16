import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { seoProfileApi, type SaveBusinessProfileRequest } from "@/lib/seo/seo-profile.api";

const QK = "seo-profile";

export function useBusinessProfile(siteId: string | null) {
  return useQuery({
    queryKey: [QK, "profile", siteId], queryFn: () => seoProfileApi.get(siteId!), enabled: !!siteId, staleTime: 30_000,
    // The website is read in the background right after it is connected: check back until that finishes.
    refetchInterval: (q) => (q.state.data?.autofillStatus === "pending" ? 3000 : false),
  });
}

export function useAutofillProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => seoProfileApi.autofill(siteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** What the workspace's own company details could fill in. Only fetched when the import panel is opened. */
export function useTenantProfilePreview(siteId: string | null, enabled: boolean) {
  return useQuery({ queryKey: [QK, "tenant-preview", siteId], queryFn: () => seoProfileApi.tenantPreview(siteId!), enabled: !!siteId && enabled });
}

export function useSaveBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, body }: { siteId: string; body: SaveBusinessProfileRequest }) => seoProfileApi.save(siteId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Business profile saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useImportProfileFromTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, overwrite }: { siteId: string; overwrite: boolean }) => seoProfileApi.importFromTenant(siteId, overwrite),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Imported from your workspace. Add what you sell to finish."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDraftProfileFromWebsite() {
  return useMutation({
    mutationFn: (siteId: string) => seoProfileApi.draftFromWebsite(siteId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSuggestCompetitors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, locationCode }: { siteId: string; locationCode: number }) => seoProfileApi.suggestCompetitors(siteId, locationCode),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seo", "credits"] }); qc.invalidateQueries({ queryKey: ["seo-competitors"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
