import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { seoContentApi, type UpdateContentSettingsRequest } from "@/lib/seo/seo-content.api";

const QK = "seo-content";

export function useContentSettings(siteId: string | null) {
  return useQuery({
    queryKey: [QK, "settings", siteId],
    queryFn: () => seoContentApi.getSettings(siteId!),
    enabled: !!siteId,
  });
}

export function useUpdateContentSettings() {
  return useContentMutation(
    ({ siteId, body }: { siteId: string; body: UpdateContentSettingsRequest }) => seoContentApi.updateSettings(siteId, body),
    "Content settings saved.",
  );
}

export function useArticles(siteId: string | null, status?: string) {
  return useQuery({
    queryKey: [QK, "articles", siteId, status ?? "all"],
    queryFn: () => seoContentApi.getArticles(siteId!, status),
    enabled: !!siteId,
    staleTime: 15 * 1000,
  });
}

export function useGenerateArticleNow() {
  return useContentMutation((siteId: string) => seoContentApi.generateNow(siteId), "Content run started — this can take a minute.");
}

export function useApproveArticle() {
  return useContentMutation((id: string) => seoContentApi.approveArticle(id), "Article approved.");
}

export function useRejectArticle() {
  return useContentMutation((id: string) => seoContentApi.rejectArticle(id), "Article rejected.");
}

export function usePushArticleToWordPress() {
  return useContentMutation((id: string) => seoContentApi.pushToWordPress(id), "Pushed to WordPress.");
}

export function useWordPressStatus(siteId: string | null) {
  return useQuery({
    queryKey: [QK, "wordpress", siteId],
    queryFn: () => seoContentApi.getWordPressStatus(siteId!),
    enabled: !!siteId,
  });
}

export function useConnectWordPress() {
  return useContentMutation(
    ({ siteId, siteUrl, username, appPassword }: { siteId: string; siteUrl: string; username: string; appPassword: string }) =>
      seoContentApi.connectWordPress(siteId, siteUrl, username, appPassword),
    "WordPress connected.",
  );
}

export function useDisconnectWordPress() {
  return useContentMutation((siteId: string) => seoContentApi.disconnectWordPress(siteId), "WordPress disconnected.");
}

export function useSetWordPressAutoPublish() {
  return useContentMutation(
    ({ siteId, autoPublish }: { siteId: string; autoPublish: boolean }) => seoContentApi.setWordPressAutoPublish(siteId, autoPublish),
  );
}

function useContentMutation<TArgs, TResult = unknown>(fn: (a: TArgs) => Promise<TResult>, msg?: string) {
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
