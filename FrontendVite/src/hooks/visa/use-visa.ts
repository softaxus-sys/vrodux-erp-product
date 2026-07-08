import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { visaApi, type CreateVisaCaseRequest, type VisaCaseDetailDto, type UpsertVisaTypeRequest } from "@/lib/visa/visa.api";
import { financeApi } from "@/lib/finance/finance.api";

const QK = "visa";

/** UAE VAT is not charged on government visa fees; service fee VAT is out of scope for the auto-draft. */
const DEFAULT_TAX_RATE = 0;

/** Builds the Finance invoice payload for a visa case (service + government fee line items). */
export function buildCaseInvoiceRequest(c: VisaCaseDetailDto) {
  const today = new Date().toISOString().split("T")[0];
  const due = new Date(Date.now() + 14 * 864e5).toISOString().split("T")[0];
  const primary = c.applicants[0];
  const items = [
    { description: `Visa service — ${c.visaTypeName} (${c.caseNumber})`, quantity: 1, unitPrice: c.serviceFee },
    ...(c.govtFee > 0 ? [{ description: `Government fees — ${c.visaTypeName}`, quantity: 1, unitPrice: c.govtFee }] : []),
  ];
  return {
    customerName: c.customerName || primary?.fullName || c.caseNumber,
    customerEmail: null,
    invoiceDate: today,
    dueDate: due,
    taxRate: DEFAULT_TAX_RATE,
    notes: `Auto-generated from visa case ${c.caseNumber}`,
    items,
  };
}

export function useVisaTypes() {
  return useQuery({ queryKey: [QK, "types"], queryFn: visaApi.getTypes, staleTime: 30 * 60 * 1000 });
}
export function useCreateVisaType() { return useVisaMutation((b: UpsertVisaTypeRequest) => visaApi.createType(b), "Visa type added."); }
export function useUpdateVisaType() { return useVisaMutation(({ id, body }: { id: string; body: UpsertVisaTypeRequest }) => visaApi.updateType(id, body), "Visa type updated."); }
export function useDeleteVisaType() { return useVisaMutation((id: string) => visaApi.deleteType(id), "Visa type removed."); }
export function useVisaCases(status?: string) {
  return useQuery({ queryKey: [QK, "cases", status ?? "all"], queryFn: () => visaApi.getCases({ status }), staleTime: 60 * 1000 });
}
/** Visa cases linked to a CRM account — used by the CRM customer drawer. `enabled` gates on permission/module. */
export function useCustomerVisaCases(customerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [QK, "cases", "customer", customerId],
    queryFn: () => visaApi.getCases({ customerId: customerId! }),
    enabled: !!customerId && enabled,
    staleTime: 60 * 1000,
  });
}
export function useVisaCasesSummary() {
  return useQuery({ queryKey: [QK, "cases-summary"], queryFn: visaApi.getSummary, staleTime: 60 * 1000 });
}
export function useVisaDashboard() {
  return useQuery({ queryKey: [QK, "dashboard"], queryFn: visaApi.getDashboard, staleTime: 60 * 1000 });
}
export function useVisaRenewals(withinDays = 90) {
  return useQuery({ queryKey: [QK, "renewals", withinDays], queryFn: () => visaApi.getRenewals(withinDays), staleTime: 60 * 1000 });
}
export function useVisaCase(id: string | null) {
  return useQuery({ queryKey: [QK, "case", id], queryFn: () => visaApi.getCase(id!), enabled: !!id });
}

function useVisaMutation<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateVisaCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateVisaCaseRequest) => visaApi.createCase(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Visa case created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useChangeCaseStatus() {
  return useVisaMutation(({ id, ...body }: { id: string; status: string; govtReference?: string | null; rejectionReason?: string | null; visaExpiryDate?: string | null; note?: string | null; byName?: string }) =>
    visaApi.changeStatus(id, body));
}
export function useAssignCase() {
  return useVisaMutation(({ id, assignedTo, byName }: { id: string; assignedTo: string; byName?: string }) =>
    visaApi.assign(id, assignedTo, byName), "Case reassigned.");
}
export function useUpdateCaseDocument() {
  return useVisaMutation(({ caseId, documentId, ...body }: { caseId: string; documentId: string; status: string; fileUrl?: string | null; expiryDate?: string | null; notes?: string | null; byName?: string }) =>
    visaApi.updateDocument(caseId, documentId, body));
}
export function useAddCaseDocument() {
  return useVisaMutation(({ caseId, ...body }: { caseId: string; applicantId?: string | null; name: string; byName?: string }) =>
    visaApi.addDocument(caseId, body), "Requirement added.");
}
export function useAddCaseNote() {
  return useVisaMutation(({ caseId, note, byName }: { caseId: string; note: string; byName?: string }) =>
    visaApi.addNote(caseId, note, byName));
}
export function useDeleteVisaCase() { return useVisaMutation((id: string) => visaApi.deleteCase(id), "Case deleted."); }

// ── Channels + submissions ───────────────────────────────────────────────────
export function useChannels() {
  return useQuery({ queryKey: [QK, "channels"], queryFn: visaApi.getChannels, staleTime: 5 * 60 * 1000 });
}
export function useConnectChannel()    { return useVisaMutation(({ channel, ...body }: { channel: string; establishmentCard?: string | null; accountRef?: string | null; secret?: string | null }) => visaApi.connectChannel(channel, body), "Channel connected."); }
export function useDisconnectChannel() { return useVisaMutation((channel: string) => visaApi.disconnectChannel(channel), "Channel disconnected."); }
export function useCaseSubmissions(caseId: string | null, enabled = true) {
  return useQuery({ queryKey: [QK, "submissions", caseId], queryFn: () => visaApi.getSubmissions(caseId!), enabled: !!caseId && enabled });
}
export function useCreateSubmission() { return useVisaMutation(({ caseId, ...body }: { caseId: string; channel: string; submissionType: string; externalReference?: string | null; notes?: string | null }) => visaApi.createSubmission(caseId, body), "Submission recorded."); }
export function useUpdateSubmission() { return useVisaMutation(({ caseId, submissionId, ...body }: { caseId: string; submissionId: string; status: string; externalReference?: string | null; notes?: string | null }) => visaApi.updateSubmission(caseId, submissionId, body)); }

/**
 * Raises a draft Finance invoice for a case's fees and links it back onto the case.
 * Cross-service orchestration (Finance + Visa are separate services) — kept client-side
 * per the "no new Finance code" design.
 */
export function useGenerateCaseInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: VisaCaseDetailDto) => {
      const invoice = await financeApi.createInvoice(buildCaseInvoiceRequest(c));
      await visaApi.linkInvoice(c.id, { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
      return invoice;
    },
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["finance", "invoices"] });
      qc.invalidateQueries({ queryKey: ["finance", "invoice-summary"] });
      toast.success(`Draft invoice ${invoice.invoiceNumber} created.`);
    },
    onError: (e: Error) => toast.error(`Invoice not created: ${e.message}`),
  });
}
