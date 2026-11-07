import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  einvoicingApi, type CreateCreditNoteRequest, type EInvoiceDocType, type UpdateEInvoiceSettings,
} from "@/lib/finance/einvoicing.api";

const QK = ["finance", "einvoicing"] as const;

export function useEInvoiceSettings() {
  return useQuery({ queryKey: [...QK, "settings"], queryFn: () => einvoicingApi.getSettings(), staleTime: 30_000 });
}

export function useUpdateEInvoiceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEInvoiceSettings) => einvoicingApi.updateSettings(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("E-invoicing settings saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEInvoiceReadiness() {
  return useQuery({ queryKey: [...QK, "readiness"], queryFn: () => einvoicingApi.getReadiness(), staleTime: 30_000 });
}

/** A check is only true for the data at the moment it ran, so it is never cached. */
export function useEInvoiceCheck(type: EInvoiceDocType, id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...QK, "check", type, id],
    queryFn: () => einvoicingApi.check(type, id!),
    enabled: enabled && !!id,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useEInvoiceSubmissions(p: { status?: string; documentId?: string; page?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: [...QK, "submissions", p],
    queryFn: () => einvoicingApi.getSubmissions(p),
    enabled,
    staleTime: 15_000,
  });
}

export function useQueueEInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: EInvoiceDocType; id: string }) => einvoicingApi.queue(v.type, v.id),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: QK });
      if (s.status === "blocked") toast.warning("Not queued: " + (s.lastError ?? "the data is incomplete."));
      else toast.success("Queued for the e-invoicing provider.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRetryEInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => einvoicingApi.retry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Queued again."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreditNotes(p: { invoiceId?: string; status?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: [...QK, "credit-notes", p],
    queryFn: () => einvoicingApi.getCreditNotes(p),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCreditNoteRequest) => einvoicingApi.createCreditNote(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Credit note drafted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => einvoicingApi.issueCreditNote(id),
    onSuccess: () => {
      // Issuing changes the invoice balance and the ledger as well as the credit note itself.
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Credit note issued.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => einvoicingApi.cancelCreditNote(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Draft cancelled."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
