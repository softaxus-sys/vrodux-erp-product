import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { financeApi } from "@/lib/finance/finance.api";
import { useAuthStore } from "@/store/auth.store";
import type {
  CreateAccountRequest, UpdateAccountRequest,
  CreateInvoiceRequest, UpdateInvoiceRequest,
  CreateExpenseRequest,
  CreateJournalEntryRequest, CreateBudgetRequest,
  CreateBankTransactionRequest,
  UpsertRecurringRequest,
} from "@/lib/finance/finance.api";

const QK = "finance";

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";
/** Current user id for approver stamping; falls back to empty Guid for super-admin/system. */
function currentApproverId(): string {
  const id = useAuthStore.getState().user?.id;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : EMPTY_GUID;
}

/**
 * Backend list endpoints return either a plain array []
 * or a paginated object { items: [], totalCount, page, … }.
 * This helper normalises both shapes to a plain array so callers
 * never have to worry about which shape the backend sends.
 */
function toItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data && Array.isArray((data as Record<string, unknown>).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export function useInvoices() {
  return useQuery({
    queryKey: [QK, "invoices"],
    queryFn:  financeApi.getInvoices,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvoiceSummary() {
  return useQuery({
    queryKey: [QK, "invoice-summary"],
    queryFn:  financeApi.getInvoiceSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccounts(params?: { search?: string; accountType?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: [QK, "accounts", params],
    queryFn:  () => financeApi.getAccounts(params),
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccountById(id: string | null) {
  return useQuery({
    queryKey: [QK, "accounts", id],
    queryFn:  () => financeApi.getAccountById(id!),
    enabled:  Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccountingSummary() {
  return useQuery({
    queryKey: [QK, "accounting-summary"],
    queryFn:  financeApi.getAccountingSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccountRequest) => financeApi.createAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "accounts"] });
      qc.invalidateQueries({ queryKey: [QK, "accounting-summary"] });
      toast.success("Account created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountRequest }) =>
      financeApi.updateAccount(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "accounts"] });
      qc.invalidateQueries({ queryKey: [QK, "accounting-summary"] });
      toast.success("Account updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "accounts"] });
      qc.invalidateQueries({ queryKey: [QK, "accounting-summary"] });
      toast.success("Account deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBankAccounts() {
  return useQuery({
    queryKey: [QK, "bank-accounts"],
    queryFn:  financeApi.getBankAccounts,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBankTransactions() {
  return useQuery({
    queryKey: [QK, "bank-transactions"],
    queryFn:  financeApi.getBankTransactions,
    select:   (data) => toItems(data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useBankingSummary() {
  return useQuery({
    queryKey: [QK, "banking-summary"],
    queryFn:  financeApi.getBankingSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: [QK, "budgets"],
    queryFn:  financeApi.getBudgets,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBudgetingSummary() {
  return useQuery({
    queryKey: [QK, "budgeting-summary"],
    queryFn:  financeApi.getBudgetingSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: [QK, "expenses"],
    queryFn:  financeApi.getExpenses,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpensesSummary() {
  return useQuery({
    queryKey: [QK, "expenses-summary"],
    queryFn:  financeApi.getExpensesSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrialBalance() {
  return useQuery({
    queryKey: [QK, "trial-balance"],
    queryFn:  financeApi.getTrialBalance,
    select:   (data) => toItems(data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useProfitLoss(from?: string, to?: string) {
  return useQuery({
    queryKey: [QK, "profit-loss", from, to],
    queryFn:  () => financeApi.getProfitLoss(from, to),
  });
}

export function useBalanceSheet(asOf?: string) {
  return useQuery({
    queryKey: [QK, "balance-sheet", asOf],
    queryFn:  () => financeApi.getBalanceSheet(asOf),
  });
}

export function useCashFlow(from?: string, to?: string) {
  return useQuery({
    queryKey: [QK, "cash-flow", from, to],
    queryFn:  () => financeApi.getCashFlow(from, to),
  });
}

export function useGLSummary() {
  return useQuery({
    queryKey: [QK, "gl-summary"],
    queryFn:  financeApi.getGLSummary,
    staleTime: 10 * 60 * 1000,
  });
}

export function useJournals() {
  return useQuery({
    queryKey: [QK, "journals"],
    queryFn:  financeApi.getJournals,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useJournalsSummary() {
  return useQuery({
    queryKey: [QK, "journals-summary"],
    queryFn:  financeApi.getJournalsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxPeriods() {
  return useQuery({
    queryKey: [QK, "tax-periods"],
    queryFn:  financeApi.getTaxPeriods,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxTransactions() {
  return useQuery({
    queryKey: [QK, "tax-transactions"],
    queryFn:  financeApi.getTaxTransactions,
    select:   (data) => toItems(data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaxSummary() {
  return useQuery({
    queryKey: [QK, "tax-summary"],
    queryFn:  financeApi.getTaxSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvoiceById(id: string | null) {
  return useQuery({
    queryKey: [QK, "invoices", id],
    queryFn:  () => financeApi.getInvoiceById(id!),
    enabled:  Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => financeApi.createInvoice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
      toast.success("Invoice created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceRequest }) =>
      financeApi.updateInvoice(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices", id] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
      toast.success("Invoice updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.sendInvoice(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices", id] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.markInvoicePaid(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices", id] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.cancelInvoice(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices", id] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) => financeApi.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "expenses"] });
      qc.invalidateQueries({ queryKey: [QK, "expenses-summary"] });
    },
  });
}

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJournalEntryRequest) => financeApi.createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "journals"] });
      qc.invalidateQueries({ queryKey: [QK, "journals-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "gl-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "trial-balance"] });
      toast.success("Journal entry created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useExpenseWorkflow(fn: (id: string) => Promise<void>, msg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "expenses"] });
      qc.invalidateQueries({ queryKey: [QK, "expenses-summary"] });
      toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveExpense() {
  return useExpenseWorkflow((id) => financeApi.approveExpense(id, currentApproverId()), "Expense approved.");
}
export function useRejectExpense() {
  return useExpenseWorkflow((id) => financeApi.rejectExpense(id, currentApproverId()), "Expense rejected.");
}
export function usePayExpense() {
  return useExpenseWorkflow((id) => financeApi.payExpense(id), "Expense marked as paid.");
}

export function usePostJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.postJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "journals"] });
      qc.invalidateQueries({ queryKey: [QK, "journals-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "gl-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "trial-balance"] });
      toast.success("Journal posted to the ledger.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVoidJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.voidJournalEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "journals"] });
      qc.invalidateQueries({ queryKey: [QK, "journals-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "gl-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "trial-balance"] });
      toast.success("Journal reversed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReconcileTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.reconcileTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bank-transactions"] });
      qc.invalidateQueries({ queryKey: [QK, "banking-summary"] });
      toast.success("Transaction reconciled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFileTaxPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.fileTaxPeriod(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "tax-periods"] });
      qc.invalidateQueries({ queryKey: [QK, "tax-summary"] });
      toast.success("VAT return filed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePayTaxPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.payTaxPeriod(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "tax-periods"] });
      qc.invalidateQueries({ queryKey: [QK, "tax-summary"] });
      toast.success("VAT payment recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Recurring invoices ──────────────────────────────────────────────────────────

export function useRecurringInvoices() {
  return useQuery({ queryKey: [QK, "recurring"], queryFn: () => financeApi.getRecurringInvoices() });
}
export function useRecurringSummary() {
  return useQuery({ queryKey: [QK, "recurring-summary"], queryFn: () => financeApi.getRecurringSummary() });
}

function useRecurringMutation<T>(fn: (arg: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "recurring"] });
      qc.invalidateQueries({ queryKey: [QK, "recurring-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      qc.invalidateQueries({ queryKey: [QK, "invoice-summary"] });
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateRecurringInvoice() {
  return useRecurringMutation((data: UpsertRecurringRequest) => financeApi.createRecurringInvoice(data), "Recurring template created.");
}
export function useUpdateRecurringInvoice() {
  return useRecurringMutation(({ id, data }: { id: string; data: UpsertRecurringRequest }) => financeApi.updateRecurringInvoice(id, data), "Template updated.");
}
export function useDeleteRecurringInvoice() {
  return useRecurringMutation((id: string) => financeApi.deleteRecurringInvoice(id), "Template deleted.");
}
export function usePauseRecurringInvoice() {
  return useRecurringMutation((id: string) => financeApi.pauseRecurringInvoice(id), "Template paused.");
}
export function useResumeRecurringInvoice() {
  return useRecurringMutation((id: string) => financeApi.resumeRecurringInvoice(id), "Template resumed.");
}
export function useGenerateRecurringNow() {
  return useRecurringMutation((id: string) => financeApi.generateRecurringNow(id), "Invoice generated.");
}
export function useRunDueRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => financeApi.runDueRecurring(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK, "recurring"] });
      qc.invalidateQueries({ queryKey: [QK, "invoices"] });
      toast.success(`${r.generated} invoice(s) generated.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBudgetRequest) => financeApi.createBudget(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "budgets"] });
      qc.invalidateQueries({ queryKey: [QK, "budgeting-summary"] });
      toast.success("Budget created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBankTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBankTransactionRequest) => financeApi.createBankTransaction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bank-transactions"] });
      qc.invalidateQueries({ queryKey: [QK, "bank-accounts"] });
      qc.invalidateQueries({ queryKey: [QK, "banking-summary"] });
      toast.success("Transaction recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
