import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  seoApi,
  type CreateSiteRequest,
  type UpdateSiteRequest,
  type SelectGooglePropertiesRequest,
} from "@/lib/seo/seo.api";

const QK = "seo";

export function useSeoSites() {
  return useQuery({ queryKey: [QK, "sites"], queryFn: seoApi.getSites, staleTime: 30 * 1000 });
}

export function useSeoSite(id: string | null) {
  return useQuery({ queryKey: [QK, "site", id], queryFn: () => seoApi.getSite(id!), enabled: !!id, staleTime: 30 * 1000 });
}

export function useCreateSeoSite() {
  return useSeoMutation((b: CreateSiteRequest) => seoApi.createSite(b), "Site added — install the snippet to start scanning.");
}

export function useUpdateSeoSite() {
  return useSeoMutation(({ id, body }: { id: string; body: UpdateSiteRequest }) => seoApi.updateSite(id, body), "Site updated.");
}

export function useDeleteSeoSite() {
  return useSeoMutation((id: string) => seoApi.deleteSite(id), "Site removed.");
}

export function useRotateSnippetKey() {
  return useSeoMutation((id: string) => seoApi.rotateSnippetKey(id), "Snippet key rotated — update the tag on your site.");
}

/** No success toast — the caller reads the returned SiteDto.verificationStatus directly and shows
 * its own "still not verified" vs "verified" state, since a false result here is a normal, expected
 * outcome (not an error) and shouldn't read as one. */
export function useVerifySiteNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seoApi.verifyNow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartGoogleOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) => seoApi.startGoogleOAuth(siteId),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useGoogleProperties(siteId: string | null, enabled = true) {
  return useQuery({
    queryKey: [QK, "google-properties", siteId],
    queryFn: () => seoApi.getGoogleProperties(siteId!),
    enabled: !!siteId && enabled,
  });
}

export function useSelectGoogleProperties() {
  return useSeoMutation(
    ({ siteId, body }: { siteId: string; body: SelectGooglePropertiesRequest }) => seoApi.selectGoogleProperties(siteId, body),
    "Google properties connected.",
  );
}

export function useSeoAudits(siteId: string | null) {
  return useQuery({ queryKey: [QK, "audits", siteId], queryFn: () => seoApi.getAudits(siteId!), enabled: !!siteId, staleTime: 30 * 1000 });
}

export function useSeoIssues(siteId: string | null, status?: string) {
  return useQuery({
    queryKey: [QK, "issues", siteId, status ?? "all"],
    queryFn: () => seoApi.getIssues(siteId!, status),
    enabled: !!siteId,
    staleTime: 30 * 1000,
  });
}

export function useSeoFixes(siteId: string | null, status?: string) {
  return useQuery({
    queryKey: [QK, "fixes", siteId, status ?? "all"],
    queryFn: () => seoApi.getFixes(siteId!, status),
    enabled: !!siteId,
    staleTime: 15 * 1000,
  });
}

export function useRunScanNow() {
  return useSeoMutation((siteId: string) => seoApi.runScanNow(siteId), "Scan started — this can take a minute.");
}

export function useApproveFix() {
  return useSeoMutation(
    ({ id, editedValueJson }: { id: string; editedValueJson?: string }) => seoApi.approveFix(id, editedValueJson),
    "Fix approved — it's now live via the snippet.",
  );
}

export function useRejectFix() {
  return useSeoMutation((id: string) => seoApi.rejectFix(id), "Fix rejected.");
}

function useSeoMutation<TArgs, TResult = unknown>(fn: (a: TArgs) => Promise<TResult>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
