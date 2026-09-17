import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { portalListingsApi } from "@/lib/crm/portal-listings.api";
import type {
  CreatePortalListingRequest, PortalListingsParams, UpdatePortalListingRequest,
  ImportListingRow, ListingPortal,
} from "@/lib/crm/portal-listings.api";

const KEY = ["crm", "portal-listings"] as const;

export function usePortalListings(params: PortalListingsParams) {
  return useQuery({
    queryKey: [...KEY, params.search ?? "", params.portal ?? "", !!params.mine],
    queryFn: () => portalListingsApi.getAll(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useCreatePortalListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePortalListingRequest) => portalListingsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Listing registered — its portal leads will come to this agent.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePortalListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePortalListingRequest }) => portalListingsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Listing updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** No default toast — the import modal shows its own created/skipped summary. */
export function useImportPortalListings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ portal, rows }: { portal: ListingPortal; rows: ImportListingRow[] }) =>
      portalListingsApi.importRows(portal, rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePortalListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalListingsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Listing removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
