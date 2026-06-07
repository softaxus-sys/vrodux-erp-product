import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transfersApi, type CreateTransferPayload } from "@/lib/inventory/transfers.api";

const QK = "inventory-transfers";

export function useStockTransfers() {
  return useQuery({
    queryKey: [QK],
    queryFn:  transfersApi.getAll,
    staleTime: 60_000,
  });
}

export function useTransfersSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn:  transfersApi.getSummary,
    staleTime: 60_000,
  });
}

function useInvalidateTransfers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [QK] });
}

export function useCreateTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (payload: CreateTransferPayload) => transfersApi.create(payload),
    onSuccess: () => { invalidate(); toast.success("Transfer created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (id: string) => transfersApi.submit(id),
    onSuccess: () => { invalidate(); toast.success("Transfer submitted for approval."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveTransfer() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: string }) => transfersApi.approve(id, by),
    onSuccess: () => { invalidate(); toast.success("Transfer approved & dispatched."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReceiveTransfer() {
  const invalidate = useInvalidateTransfers();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transfersApi.receive(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["inventory-product-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      toast.success("Transfer received — stock moved between warehouses.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
