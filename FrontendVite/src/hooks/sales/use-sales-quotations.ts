import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  quotationsApi,
  type GetQuotationsParams,
  type CreateQuotationRequest,
  type UpdateQuotationRequest,
  type QuotationDto,
  type QuotationSummaryDto,
  type QuotationTemplateDto,
  type SaveQuotationTemplateRequest,
} from "@/lib/sales/quotations.api";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

export const salesQuotationKeys = {
  all:       ["sales-quotations"] as const,
  lists:     () => [...salesQuotationKeys.all, "list"] as const,
  list:      (params: GetQuotationsParams) => [...salesQuotationKeys.lists(), params] as const,
  details:   () => [...salesQuotationKeys.all, "detail"] as const,
  detail:    (id: string) => [...salesQuotationKeys.details(), id] as const,
  templates: () => [...salesQuotationKeys.all, "templates"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────
export function useSalesQuotations(params: GetQuotationsParams = {}) {
  return useQuery<PagedResult<QuotationSummaryDto>>({
    queryKey: salesQuotationKeys.list(params),
    queryFn:  () => quotationsApi.getAll(params),
  });
}

export function useSalesQuotation(id: string | null) {
  return useQuery<QuotationDto>({
    queryKey: salesQuotationKeys.detail(id ?? ""),
    queryFn:  () => quotationsApi.getById(id!),
    enabled:  !!id,
  });
}

/** Quotations attached to one Finance invoice — powers the invoice drawer's list. */
export function useQuotationsForInvoice(invoiceId: string | null, enabled = true) {
  return useQuery<PagedResult<QuotationSummaryDto>>({
    queryKey: salesQuotationKeys.list({ invoiceId: invoiceId ?? "", pageSize: 50 }),
    queryFn:  () => quotationsApi.getAll({ invoiceId: invoiceId!, pageSize: 50 }),
    enabled:  !!invoiceId && enabled,
  });
}

export function useQuotationTemplates(includeInactive = false) {
  return useQuery<QuotationTemplateDto[]>({
    queryKey: [...salesQuotationKeys.templates(), includeInactive],
    queryFn:  () => quotationsApi.getTemplates(includeInactive),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────
/**
 * Shared mutation wrapper. Every quotation mutation invalidates the list and, where it acts on
 * one quotation, that quotation's detail — the drawer and the list otherwise disagree about
 * status the moment anything is sent or answered.
 */
function useQuotationMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); idOf?: (args: TArgs) => string | undefined } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      const id = opts.idOf?.(args);
      if (id) qc.invalidateQueries({ queryKey: salesQuotationKeys.detail(id) });
      if (opts.success) {
        toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateSalesQuotation() {
  return useQuotationMutation(
    (payload: CreateQuotationRequest) => quotationsApi.create(payload),
    { success: "Quotation created." });
}

export function useUpdateSalesQuotation() {
  return useQuotationMutation(
    ({ id, ...payload }: { id: string } & UpdateQuotationRequest) => quotationsApi.update(id, payload),
    { success: "Quotation saved.", idOf: a => a.id });
}

export function useDeleteSalesQuotation() {
  return useQuotationMutation((id: string) => quotationsApi.delete(id), { success: "Quotation deleted." });
}

export function useDuplicateQuotation() {
  return useQuotationMutation((id: string) => quotationsApi.duplicate(id),
    { success: "Copied to a new draft." });
}

/**
 * Sends the quotation. The toast reports what actually happened: the backend returns
 * emailSent=false with the share link when SMTP is unconfigured or delivery failed, and saying
 * "sent" there would leave the user believing a customer had been emailed when they had not.
 */
export function useSendQuotation() {
  return useQuotationMutation(
    ({ id, ...body }: { id: string; toEmail?: string | null; message?: string | null; sendEmail?: boolean }) =>
      quotationsApi.send(id, body),
    {
      idOf:    a => a.id,
      success: r => r.emailSent
        ? `Quotation emailed to ${r.sentTo}.`
        : r.warning ?? "Quotation is ready to share.",
    });
}

export function useCreateQuotationShareLink() {
  return useQuotationMutation((id: string) => quotationsApi.createShareLink(id), { idOf: id => id });
}

export function useRevokeQuotationShareLink() {
  return useQuotationMutation((id: string) => quotationsApi.revokeShareLink(id),
    { success: "Share link revoked. The old link no longer opens.", idOf: id => id });
}

export function useRespondToQuotation() {
  return useQuotationMutation(
    ({ id, ...body }: { id: string; accepted: boolean; byName?: string | null; comment?: string | null }) =>
      quotationsApi.respond(id, body),
    { idOf: a => a.id, success: r => r.status === "approved" ? "Marked as accepted." : "Marked as declined." });
}

export function useConvertQuotationToOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.convertToOrder(id),
    onSuccess: (result, id) => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      qc.invalidateQueries({ queryKey: salesQuotationKeys.detail(id) });
      // The new order must appear in the orders list without a manual refresh.
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success(`Sales order ${result.orderNumber} created.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useLinkQuotationInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, invoiceId, invoiceNumber }:
      { id: string; invoiceId: string | null; invoiceNumber: string | null }) =>
      quotationsApi.linkInvoice(id, { invoiceId, invoiceNumber }),
    onSuccess: (_r, { id, invoiceId }) => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.lists() });
      qc.invalidateQueries({ queryKey: salesQuotationKeys.detail(id) });
      toast.success(invoiceId ? "Quotation attached to the invoice." : "Quotation detached from the invoice.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Templates ─────────────────────────────────────────────────────────────────
function useTemplateMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesQuotationKeys.templates() });
      toast.success(success);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateQuotationTemplate() {
  return useTemplateMutation(
    (payload: SaveQuotationTemplateRequest) => quotationsApi.createTemplate(payload), "Template created.");
}

export function useUpdateQuotationTemplate() {
  return useTemplateMutation(
    ({ id, ...payload }: { id: string } & SaveQuotationTemplateRequest) =>
      quotationsApi.updateTemplate(id, payload), "Template saved.");
}

export function useDeleteQuotationTemplate() {
  return useTemplateMutation((id: string) => quotationsApi.deleteTemplate(id), "Template deleted.");
}
