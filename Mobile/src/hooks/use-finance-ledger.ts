import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeLedgerApi } from "@/lib/finance-ledger.api";
import type { BudgetPageParams, BudgetStatus, JournalPageParams, RecurringPageParams } from "@/types/finance-ledger";

const QK = "finance-ledger" as const;

// ── Budgets ──────────────────────────────────────────────────────────────────────────────────
export function useBudgets(params: BudgetPageParams) {
  return useQuery({
    queryKey: [QK, "budgets", params],
    queryFn: () => financeLedgerApi.getBudgets(params),
  });
}

export function useBudgetingSummary() {
  return useQuery({
    queryKey: [QK, "budgeting-summary"],
    queryFn: financeLedgerApi.getBudgetingSummary,
  });
}

export function useChangeBudgetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BudgetStatus }) => financeLedgerApi.changeBudgetStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "budgets"] });
      qc.invalidateQueries({ queryKey: [QK, "budgeting-summary"] });
    },
  });
}

// ── Journals ─────────────────────────────────────────────────────────────────────────────────
export function useJournals(params: JournalPageParams) {
  return useQuery({
    queryKey: [QK, "journals", params],
    queryFn: () => financeLedgerApi.getJournals(params),
  });
}

export function useJournalsSummary() {
  return useQuery({
    queryKey: [QK, "journals-summary"],
    queryFn: financeLedgerApi.getJournalsSummary,
  });
}

function useJournalAction(fn: (id: string) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "journals"] });
      qc.invalidateQueries({ queryKey: [QK, "journals-summary"] });
    },
  });
}

export function usePostJournalEntry() {
  return useJournalAction(financeLedgerApi.postJournalEntry);
}

export function useVoidJournalEntry() {
  return useJournalAction(financeLedgerApi.voidJournalEntry);
}

// ── Tax / VAT ────────────────────────────────────────────────────────────────────────────────
export function useTaxPeriods() {
  return useQuery({
    queryKey: [QK, "tax-periods"],
    queryFn: financeLedgerApi.getTaxPeriods,
  });
}

export function useTaxTransactions(period: string) {
  return useQuery({
    queryKey: [QK, "tax-transactions", period],
    queryFn: () => financeLedgerApi.getTaxTransactions(period),
    enabled: Boolean(period),
  });
}

export function useTaxSummary() {
  return useQuery({
    queryKey: [QK, "tax-summary"],
    queryFn: financeLedgerApi.getTaxSummary,
  });
}

function useTaxPeriodAction(fn: (id: string) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "tax-periods"] });
      qc.invalidateQueries({ queryKey: [QK, "tax-summary"] });
    },
  });
}

export function useFileTaxPeriod() {
  return useTaxPeriodAction(financeLedgerApi.fileTaxPeriod);
}

export function usePayTaxPeriod() {
  return useTaxPeriodAction(financeLedgerApi.payTaxPeriod);
}

// ── Recurring Invoices ───────────────────────────────────────────────────────────────────────
export function useRecurringInvoices(params: RecurringPageParams) {
  return useQuery({
    queryKey: [QK, "recurring", params],
    queryFn: () => financeLedgerApi.getRecurringInvoices(params),
  });
}

export function useRecurringSummary() {
  return useQuery({
    queryKey: [QK, "recurring-summary"],
    queryFn: financeLedgerApi.getRecurringSummary,
  });
}

function useRecurringAction(fn: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "recurring"] });
      qc.invalidateQueries({ queryKey: [QK, "recurring-summary"] });
    },
  });
}

export function usePauseRecurring() {
  return useRecurringAction(financeLedgerApi.pauseRecurringInvoice);
}

export function useResumeRecurring() {
  return useRecurringAction(financeLedgerApi.resumeRecurringInvoice);
}

export function useGenerateRecurringNow() {
  return useRecurringAction(financeLedgerApi.generateRecurringNow);
}
