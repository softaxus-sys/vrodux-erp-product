import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  storeApi, type CollectionInput, type DiscountInput, type PageInput, type ShippingZoneInput, type StoreSettingsUpdate,
} from "@/lib/ecommerce/store.api";

const QK = "ecommerce-store";

export const useStoreSettings = () => useQuery({ queryKey: [QK, "settings"], queryFn: storeApi.get });
export const usePages = () => useQuery({ queryKey: [QK, "pages"], queryFn: storeApi.pages });
export const usePage = (id: string | null) => useQuery({ queryKey: [QK, "page", id], queryFn: () => storeApi.page(id!), enabled: !!id });
export const useAssets = (enabled = true) => useQuery({ queryKey: [QK, "assets"], queryFn: storeApi.assets, enabled, staleTime: 60_000 });
export const useCollections = () => useQuery({ queryKey: [QK, "collections"], queryFn: storeApi.collections });
export const useShippingZones = () => useQuery({ queryKey: [QK, "shipping"], queryFn: storeApi.shipping });
export const useDiscounts = () => useQuery({ queryKey: [QK, "discounts"], queryFn: storeApi.discounts });
export const useStoreOrders = (p: { search?: string; status?: string; paymentStatus?: string; page: number; pageSize: number }) =>
  useQuery({ queryKey: [QK, "orders", p], queryFn: () => storeApi.orders(p), placeholderData: keepPreviousData, refetchInterval: 30_000 });
export const useStoreOrdersSummary = () => useQuery({ queryKey: [QK, "orders-summary"], queryFn: storeApi.ordersSummary, refetchInterval: 30_000 });
export const useStoreOrder = (id: string | null) => useQuery({ queryKey: [QK, "order", id], queryFn: () => storeApi.order(id!), enabled: !!id });
export const useStoreCustomers = (p: { search?: string; page: number; pageSize: number }) =>
  useQuery({ queryKey: [QK, "customers", p], queryFn: () => storeApi.customers(p), placeholderData: keepPreviousData });

function useStoreMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, success?: string | ((r: TResult) => string | null)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: [QK] });
      const msg = typeof success === "function" ? success(r) : success;
      if (msg) toast.success(msg);
    },
    // Validation failures are shown next to the field by the form; everything else is a toast.
    onError: (e: Error & { fieldErrors?: Record<string, string[]> }) => { if (!e.fieldErrors || Object.keys(e.fieldErrors).length === 0) toast.error(e.message); },
  });
}

export const useCreateStore = () => useStoreMutation((a: { name: string; slug: string }) => storeApi.create(a.name, a.slug), "Your store has been created.");
export const useUpdateStore = () => useStoreMutation((b: StoreSettingsUpdate) => storeApi.update(b), "Store settings saved.");

export const useSavePage = () => useStoreMutation((a: { id: string | null; body: PageInput }) => a.id ? storeApi.updatePage(a.id, a.body) : storeApi.createPage(a.body), "Page saved.");
export const useDeletePage = () => useStoreMutation((id: string) => storeApi.deletePage(id), "Page deleted.");
export const useUploadAsset = () => useStoreMutation((f: File) => storeApi.upload(f));

export const useSaveCollection = () => useStoreMutation((a: { id: string | null; body: CollectionInput }) => storeApi.saveCollection(a.id, a.body), "Collection saved.");
export const useDeleteCollection = () => useStoreMutation((id: string) => storeApi.deleteCollection(id), "Collection deleted.");
export const useSaveZone = () => useStoreMutation((a: { id: string | null; body: ShippingZoneInput }) => storeApi.saveZone(a.id, a.body), "Delivery option saved.");
export const useDeleteZone = () => useStoreMutation((id: string) => storeApi.deleteZone(id), "Delivery option deleted.");
export const useSaveDiscount = () => useStoreMutation((a: { id: string | null; body: DiscountInput }) => storeApi.saveDiscount(a.id, a.body), "Discount saved.");
export const useDeleteDiscount = () => useStoreMutation((id: string) => storeApi.deleteDiscount(id), "Discount deleted.");

export const useMarkOrderPaid = () => useStoreMutation((a: { id: string; reference?: string }) => storeApi.markPaid(a.id, a.reference), "Marked as paid.");
export const useShipOrder = () => useStoreMutation((a: { id: string; carrier?: string; trackingNumber?: string; trackingUrl?: string }) => storeApi.ship(a.id, a), "Order marked as shipped.");
export const useDeliverOrder = () => useStoreMutation((id: string) => storeApi.deliver(id), "Order marked as delivered.");
export const useCancelStoreOrder = () => useStoreMutation((a: { id: string; reason?: string }) => storeApi.cancel(a.id, a.reason), "Order cancelled.");
export const useRefundStoreOrder = () => useStoreMutation((a: { id: string; reason?: string }) => storeApi.refund(a.id, a.reason), "Payment refunded.");
export const useSetOrderNote = () => useStoreMutation((a: { id: string; note: string }) => storeApi.setNote(a.id, a.note), "Note saved.");
