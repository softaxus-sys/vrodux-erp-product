import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeApi } from "@/lib/finance.api";
import type {
  AccountsPageParams,
  BankTxPageParams,
  CreateExpensePayload,
  ExpensesPageParams,
  InvoicesPageParams,
} from "@/types/finance";

const QK = "finance" as const;

// ── Invoices ─────────────────────────────────────────────────────────────────────────────────
export function useInvoicesPaged(params: InvoicesPageParams) {
  return useQuery({
    queryKey: [QK, "invoices", "paged", params],
    queryFn: () => financeApi.getInvoices(params),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: [QK, "invoice", id],
    queryFn: () => financeApi.getInvoice(id),
    enabled: Boolean(id),
  });
}

function useInvoiceAction(fn: (id: string) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "invoice", id] });
      qc.invalidateQueries({ queryKey: [QK, "invoices", "paged"] });
    },
  });
}

export function useSendInvoice() {
  return useInvoiceAction(financeApi.sendInvoice);
}

export function useMarkInvoicePaid() {
  return useInvoiceAction(financeApi.markInvoicePaid);
}

// ── Expenses ─────────────────────────────────────────────────────────────────────────────────
export function useExpensesPaged(params: ExpensesPageParams) {
  return useQuery({
    queryKey: [QK, "expenses", "paged", params],
    queryFn: () => financeApi.getExpenses(params),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: [QK, "expense", id],
    queryFn: () => financeApi.getExpense(id),
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) => financeApi.createExpense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "expenses", "paged"] }),
  });
}

// ── Accounts (chart of accounts) ────────────────────────────────────────────────────────────
export function useAccounts(params: AccountsPageParams = {}) {
  return useQuery({
    queryKey: [QK, "accounts", params],
    queryFn: () => financeApi.getAccounts(params),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: [QK, "account", id],
    queryFn: () => financeApi.getAccount(id),
    enabled: Boolean(id),
  });
}

export function useAccountingSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "accounting-summary"],
    queryFn: financeApi.getAccountingSummary,
    enabled,
  });
}

export function useAccountTypes() {
  return useQuery({
    queryKey: [QK, "account-types"],
    queryFn: financeApi.getAccountTypes,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Banking ──────────────────────────────────────────────────────────────────────────────────
export function useBankAccounts() {
  return useQuery({
    queryKey: [QK, "bank-accounts"],
    queryFn: financeApi.getBankAccounts,
  });
}

export function useBankTransactions(params: BankTxPageParams) {
  return useQuery({
    queryKey: [QK, "bank-transactions", params],
    queryFn: () => financeApi.getBankTransactions(params),
  });
}

export function useBankingSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "banking-summary"],
    queryFn: financeApi.getBankingSummary,
    enabled,
  });
}

export function useReconcileTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.reconcileTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bank-transactions"] });
      qc.invalidateQueries({ queryKey: [QK, "banking-summary"] });
    },
  });
}
