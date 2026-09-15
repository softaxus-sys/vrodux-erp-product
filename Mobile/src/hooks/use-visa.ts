import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { visaApi, type ChangeCaseStatusBody, type UpdateCaseDocumentBody } from "@/lib/visa.api";

const QK = "visa" as const;

export function useVisaDashboard(enabled = true) {
  return useQuery({
    queryKey: [QK, "dashboard"],
    queryFn: visaApi.getDashboard,
    enabled,
  });
}

export function useVisaRenewals(withinDays: number, enabled = true) {
  return useQuery({
    queryKey: [QK, "renewals", withinDays],
    queryFn: () => visaApi.getRenewals(withinDays),
    enabled,
  });
}

export function useVisaCasesSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "cases", "summary"],
    queryFn: visaApi.getSummary,
    enabled,
  });
}

export function useVisaCases(status: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "cases", status],
    queryFn: () => visaApi.getCases(status),
    enabled,
  });
}

export function useVisaCase(id: string) {
  return useQuery({
    queryKey: [QK, "case", id],
    queryFn: () => visaApi.getCase(id),
    enabled: Boolean(id),
  });
}

function invalidateCase(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: [QK, "case", id] });
  qc.invalidateQueries({ queryKey: [QK, "cases"] });
  qc.invalidateQueries({ queryKey: [QK, "dashboard"] });
  qc.invalidateQueries({ queryKey: [QK, "renewals"] });
}

export function useChangeCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ChangeCaseStatusBody }) => visaApi.changeStatus(id, body),
    onSuccess: (_data, { id }) => invalidateCase(qc, id),
  });
}

export function useAssignCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedTo, byName }: { id: string; assignedTo: string; byName?: string }) => visaApi.assign(id, assignedTo, byName),
    onSuccess: (_data, { id }) => invalidateCase(qc, id),
  });
}

export function useUpdateCaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, documentId, body }: { caseId: string; documentId: string; body: UpdateCaseDocumentBody }) =>
      visaApi.updateDocument(caseId, documentId, body),
    onSuccess: (_data, { caseId }) => invalidateCase(qc, caseId),
  });
}

export function useAddCaseNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, note, byName }: { caseId: string; note: string; byName?: string }) => visaApi.addNote(caseId, note, byName),
    onSuccess: (_data, { caseId }) => invalidateCase(qc, caseId),
  });
}
