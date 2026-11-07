import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { leadgenApi, isSearchActive, type ProspectFilter, type SearchInput, type ThreadFilter } from "@/lib/leadgen.api";

const K = "leadgen";

export const useLgMeta = () => useQuery({ queryKey: [K, "meta"], queryFn: leadgenApi.getMeta, staleTime: 5 * 60_000 });
export const useLgDashboard = (enabled = true) =>
  useQuery({ queryKey: [K, "dashboard"], queryFn: () => leadgenApi.getDashboard(30), enabled });
export const useLgWallet = (enabled = true) => useQuery({ queryKey: [K, "wallet"], queryFn: leadgenApi.getWallet, enabled });
export const useLgLedger = (page: number, enabled = true) =>
  useQuery({ queryKey: [K, "ledger", page], queryFn: () => leadgenApi.getLedger({ page, pageSize: 25 }), enabled });
export const useLgInboxCounts = (enabled = true) =>
  useQuery({ queryKey: [K, "inbox-counts"], queryFn: leadgenApi.getInboxCounts, enabled, refetchInterval: 60_000 });

/** Searches refresh every few seconds while any is still running. */
export function useLgSearches(enabled = true) {
  return useQuery({
    queryKey: [K, "searches"],
    queryFn: leadgenApi.getSearches,
    enabled,
    refetchInterval: (q) => ((q.state.data ?? []).some(isSearchActive) ? 4000 : false),
  });
}

/** Accumulating pager over a `Paged<T>` endpoint, with a search box that resets to page 1. */
export function usePagedLg<T>(
  keyParts: readonly unknown[],
  fetchPage: (page: number) => Promise<{ items: T[]; total: number; page: number; pageSize: number }>,
  enabled = true,
) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const keySig = JSON.stringify(keyParts);
  const query = useQuery({ queryKey: [K, "paged", ...keyParts, page], queryFn: () => fetchPage(page), enabled });

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [keySig]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data.page === 1 ? query.data.items : [...prev, ...query.data.items]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const hasMore = query.data ? query.data.page * query.data.pageSize < query.data.total : false;
  return {
    items,
    total: query.data?.total ?? 0,
    hasMore,
    loadMore: () => {
      if (hasMore && !query.isFetching) setPage((p) => p + 1);
    },
    refresh: () => (page === 1 ? query.refetch() : setPage(1)),
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
  };
}

export const useLgProspectsPaged = (f: Omit<ProspectFilter, "page" | "pageSize">, enabled = true) =>
  usePagedLg(["prospects", f], (page) => leadgenApi.getProspects({ ...f, page, pageSize: 25 }), enabled);
export const useLgThreadsPaged = (f: Omit<ThreadFilter, "page" | "pageSize">, enabled = true) =>
  usePagedLg(["threads", f], (page) => leadgenApi.getThreads({ ...f, page, pageSize: 25 }), enabled);

export const useLgProspect = (id: string) => useQuery({ queryKey: [K, "prospect", id], queryFn: () => leadgenApi.getProspect(id) });
export const useLgCampaigns = (enabled = true) => useQuery({ queryKey: [K, "campaigns"], queryFn: leadgenApi.getCampaigns, enabled });
export const useLgCampaign = (id: string) => useQuery({ queryKey: [K, "campaign", id], queryFn: () => leadgenApi.getCampaign(id) });
export const useLgMailboxes = (enabled = true) => useQuery({ queryKey: [K, "mailboxes"], queryFn: leadgenApi.getMailboxes, enabled });
export const useLgThread = (id: string) => useQuery({ queryKey: [K, "thread", id], queryFn: () => leadgenApi.getThread(id) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [K] });
}

export function useLgEstimate() {
  return useMutation({ mutationFn: (r: SearchInput) => leadgenApi.estimateSearch(r) });
}
export function useLgCreateSearch() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (r: SearchInput) => leadgenApi.createSearch(r), onSuccess: inv });
}
export function useLgCancelSearch() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => leadgenApi.cancelSearch(id), onSuccess: inv });
}
export function useLgReveal() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (ids: string[]) => leadgenApi.revealProspects(ids), onSuccess: inv });
}
export function useLgImportToCrm() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (ids: string[]) => leadgenApi.importToCrm(ids), onSuccess: inv });
}
export function useLgUpdateProspect() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...r }: { id: string; status?: string; notes?: string }) => leadgenApi.updateProspect(id, r),
    onSuccess: inv,
  });
}
export function useLgCampaignAction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "pause" | "stop" }) =>
      action === "start" ? leadgenApi.startCampaign(id) : action === "pause" ? leadgenApi.pauseCampaign(id) : leadgenApi.stopCampaign(id),
    onSuccess: inv,
  });
}
export function useLgMailboxAction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "sync" }): Promise<void> => {
      if (action === "pause") await leadgenApi.pauseMailbox(id);
      else if (action === "resume") await leadgenApi.resumeMailbox(id);
      else await leadgenApi.syncMailbox(id);
    },
    onSuccess: inv,
  });
}
export function useLgReply() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => leadgenApi.reply(id, body), onSuccess: inv });
}
export function useLgUpdateThread() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...r }: { id: string; classification?: string; archived?: boolean; markRead?: boolean }) => leadgenApi.updateThread(id, r),
    onSuccess: inv,
  });
}
