import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vouchersApi, type UpsertVoucherPayload } from "@/lib/pos/vouchers.api";
import type { VoucherDto } from "@/lib/pos/types";
import { toast } from "sonner";

export const voucherKeys = {
  all:   ["pos-vouchers"] as const,
  lists: () => [...voucherKeys.all, "list"] as const,
};

export function useVouchers() {
  return useQuery<VoucherDto[]>({
    queryKey: voucherKeys.lists(),
    queryFn:  vouchersApi.getAll,
    staleTime: 30_000,
  });
}

export function useUpsertVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertVoucherPayload) => vouchersApi.upsert(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: voucherKeys.lists() });
      toast.success(`Voucher "${data.code}" saved.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vouchersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: voucherKeys.lists() });
      toast.success("Voucher deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Imperative voucher validation for the POS discount panel. */
export function useValidateVoucher() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      vouchersApi.validate(code, subtotal),
  });
}
