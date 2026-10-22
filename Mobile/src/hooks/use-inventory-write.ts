import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryWriteApi } from "@/lib/inventory-write.api";

const QK = "inventory" as const;

export function useCategories() {
  return useQuery({ queryKey: [QK, "categories"], queryFn: inventoryWriteApi.getCategories, staleTime: 5 * 60_000 });
}

export function useTransfers(status?: string) {
  return useQuery({ queryKey: [QK, "transfers", status ?? "all"], queryFn: () => inventoryWriteApi.getTransfers(status) });
}

function useInv() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [QK] });
}

export function useCreateProduct() {
  const inv = useInv();
  return useMutation({ mutationFn: inventoryWriteApi.createProduct, onSuccess: inv });
}

export function useCreateMovement() {
  const inv = useInv();
  return useMutation({ mutationFn: inventoryWriteApi.createMovement, onSuccess: inv });
}

/** Creates the transfer and submits it for approval in one go -- a draft nobody can act on is not useful on a phone. */
export function useCreateTransfer() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (t: Parameters<typeof inventoryWriteApi.createTransfer>[0]) => {
      const created = await inventoryWriteApi.createTransfer(t);
      await inventoryWriteApi.submitTransfer(created.id);
      return created;
    },
    onSuccess: inv,
  });
}

export function useTransferAction() {
  const inv = useInv();
  return useMutation({
    mutationFn: ({ id, action, by }: { id: string; action: "approve" | "receive"; by: string }) =>
      action === "approve" ? inventoryWriteApi.approveTransfer(id, by) : inventoryWriteApi.receiveTransfer(id),
    onSuccess: inv,
  });
}
