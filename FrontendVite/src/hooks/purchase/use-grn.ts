import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  goodsReceiptNotesApi,
  type GetGoodsReceiptNotesParams,
  type CreateGoodsReceiptNoteRequest,
  type GoodsReceiptNoteDto,
  type GoodsReceiptNoteSummaryDto,
} from "@/lib/purchase/grn.api";
import { purchaseOrderKeys } from "@/hooks/purchase/use-purchase-orders";
import { toast } from "sonner";

export const grnKeys = {
  all:     ["goods-receipt-notes"] as const,
  lists:   () => [...grnKeys.all, "list"] as const,
  list:    (params: GetGoodsReceiptNotesParams) => [...grnKeys.lists(), params] as const,
  details: () => [...grnKeys.all, "detail"] as const,
  detail:  (id: string) => [...grnKeys.details(), id] as const,
};

export function useGoodsReceiptNotes(params: GetGoodsReceiptNotesParams = {}) {
  return useQuery<GoodsReceiptNoteSummaryDto[]>({
    queryKey: grnKeys.list(params),
    queryFn:  () => goodsReceiptNotesApi.getAll(params),
  });
}

export function useGoodsReceiptNote(id: string | null) {
  return useQuery<GoodsReceiptNoteDto>({
    queryKey: grnKeys.detail(id ?? ""),
    queryFn:  () => goodsReceiptNotesApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreateGoodsReceiptNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGoodsReceiptNoteRequest) => goodsReceiptNotesApi.create(payload),
    onSuccess: (grn) => {
      qc.invalidateQueries({ queryKey: grnKeys.lists() });
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      // Receiving changes stock, so every stock screen must refetch.
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory-product-stock"] });
      const added = grn?.stockLinesAdded ?? 0;
      toast.success(added > 0
        ? `Goods receipt created. Stock updated for ${added} item${added === 1 ? "" : "s"}.`
        : "Goods receipt note created.");
      if (grn?.stockNote) toast.warning(grn.stockNote, { duration: 10000 });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
