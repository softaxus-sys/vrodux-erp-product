import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { ecommerceApi, type ConnectChannelRequest, type SyncResultDto, type UpdateChannelRequest } from "@/lib/ecommerce/ecommerce.api";

const QK = "ecommerce";

export const useProviders = () => useQuery({ queryKey: [QK, "providers"], queryFn: ecommerceApi.providers, staleTime: 600_000 });

/** Refreshes every 30 s: the background sync changes status, counts and errors without anyone pressing anything. */
export const useChannels = () => useQuery({ queryKey: [QK, "channels"], queryFn: ecommerceApi.channels, refetchInterval: 30_000 });

export const useChannelLocations = (id: string | null, enabled = true) =>
  useQuery({ queryKey: [QK, "locations", id], queryFn: () => ecommerceApi.locations(id!), enabled: !!id && enabled, staleTime: 120_000, retry: false });

export const useListings = (channelId?: string) =>
  useQuery({ queryKey: [QK, "listings", channelId ?? "all"], queryFn: () => ecommerceApi.listings({ channelId }), refetchInterval: 30_000 });

export const useChannelOrders = (params: { channelId?: string; search?: string; status?: string; page: number; pageSize: number }) =>
  useQuery({ queryKey: [QK, "orders", params], queryFn: () => ecommerceApi.orders(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });

export const useTemplateLookup = (search: string, enabled: boolean) =>
  useQuery({ queryKey: [QK, "templates", search], queryFn: () => ecommerceApi.templates(search), enabled, placeholderData: keepPreviousData });

function useEcommerceMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, opts: { success?: (r: TResult) => string | null } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: [QK] });
      const msg = opts.success?.(r);
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useConnectChannel = () => useEcommerceMutation((r: ConnectChannelRequest) => ecommerceApi.connect(r));
export const useUpdateChannel = () => useEcommerceMutation((a: { id: string; body: UpdateChannelRequest }) => ecommerceApi.updateChannel(a.id, a.body));
export const useReplaceToken = () => useEcommerceMutation((a: { id: string; token: string }) => ecommerceApi.replaceToken(a.id, a.token));
export const useDisconnectChannel = () => useEcommerceMutation((id: string) => ecommerceApi.disconnect(id));

/** The caller reports the result (it has a translated sentence for it), so no default toast here. */
export const useSyncChannel = () => useEcommerceMutation((a: { id: string; resetStock?: boolean }) => ecommerceApi.syncChannel(a.id, a.resetStock));
export const useImportOrders = () => useEcommerceMutation((id: string) => ecommerceApi.importOrders(id));

export const usePublishListing = () => useEcommerceMutation((a: { channelId: string; templateId: string }) => ecommerceApi.publish(a.channelId, a.templateId));
export const useSyncListing = () => useEcommerceMutation((id: string) => ecommerceApi.syncListing(id));
export const useUnpublishListing = () => useEcommerceMutation((id: string) => ecommerceApi.unpublish(id));
export const useRemoveListing = () => useEcommerceMutation((a: { id: string; deleteInStore: boolean }) => ecommerceApi.removeListing(a.id, a.deleteInStore));

export type { SyncResultDto };
