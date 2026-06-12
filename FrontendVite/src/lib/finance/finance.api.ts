import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/finance`;

// ─── Invoicing ────────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";
export type PaymentMethod = "bank_transfer" | "cash" | "cheque" | "card" | "online";

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;      // backend: invoiceNumber
  customerName: string;
  customerEmail: string;
  invoiceDate: string;        // backend: invoiceDate  (was issueDate)
  dueDate: string;
  taxRate: number;
  subTotal: number;           // backend: subTotal     (was subtotal)
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  itemCount: number;          // backend: itemCount    (list returns count, not items array)
  paidAt?: string | null;     // backend: paidAt       (was paidDate)
  createdAt: string;
  updatedAt?: string | null;
}

export interface InvoiceSummaryDto {
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalOverdue: number;
  totalOutstanding: number;
  draftCount: number;
}

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetailDto {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  subTotal: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  notes?: string | null;
  items: InvoiceItemDto[];
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

// ─── Accounting ───────────────────────────────────────────────────────────────

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface AccountDto {
  id: string;
  accountNumber: string;
  name: string;
  accountType: AccountType;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  balance: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AccountingSummaryDto {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface CreateAccountRequest {
  accountNumber: string;
  name: string;
  accountType: AccountType;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export interface UpdateAccountRequest {
  accountNumber: string;
  name: string;
  accountType: AccountType;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

// ─── Banking ──────────────────────────────────────────────────────────────────

export interface BankAccountDto {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  currency: string;
  balance: number;
  availableBalance: number;
  status: "active" | "inactive";
  accountType: "current" | "savings";
  lastSynced: string;
}

export interface BankTransactionDto {
  id: string;
  accountId: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: "credit" | "debit";
  category: string;
  reconciled: boolean;
  balance: number;
}

export interface BankingSummaryDto {
  totalBalance: number;
  totalAccounts: number;
  totalCreditThisMonth: number;
  totalDebitThisMonth: number;
  unreconciled: number;
}

// ─── Budgeting ────────────────────────────────────────────────────────────────

export type BudgetStatus = "draft" | "approved" | "active" | "closed";

export interface BudgetDto {
  id: string;
  name: string;
  period: string;
  status: BudgetStatus;
  totalBudgeted: number;
  totalActual: number;
  variance: number;
  lineCount: number;
}

export interface BudgetingSummaryDto {
  totalBudget: number;
  totalActual: number;
  overallVariance: number;
  variancePct: number;
  depsOverBudget: number;
  depsUnderBudget: number;
  utilisation: number;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseStatus = "draft" | "pending" | "approved" | "rejected" | "paid";

export interface ExpenseDto {
  id: string;
  expenseNumber: string;
  title: string;
  category: string;
  paidBy: string;
  expenseDate: string;
  status: ExpenseStatus;
  amount: number;
  currency?: string;
  approvedBy?: string;
  approvedAt?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface ExpensesSummaryDto {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
  totalAmount: number;
  totalPaid: number;
  pendingApproval: number;
}

// ─── Suppliers ──────────────────────────────────────────────────────────────────

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  accountId?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

// ─── Purchase Bills (AP Invoices) ────────────────────────────────────────────────

export type PurchaseBillStatus = "draft" | "approved" | "partially_paid" | "paid" | "cancelled";

export interface PurchaseBillItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseBillSummaryDto {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  taxRate: number;
  currencyCode: string;
  subTotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: PurchaseBillStatus;
  itemCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PurchaseBillDto {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  billDate: string;
  dueDate: string;
  taxRate: number;
  currencyCode: string;
  subTotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: PurchaseBillStatus;
  reference?: string | null;
  notes?: string | null;
  items: PurchaseBillItemDto[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface PurchaseBillsSummaryDto {
  totalBills: number;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  draftCount: number;
  outstandingCount: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PurchaseBillItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseBillRequest {
  supplierId: string;
  billDate: string;
  dueDate: string;
  taxRate: number;
  currencyCode?: string | null;
  reference?: string | null;
  notes?: string | null;
  items: PurchaseBillItemRequest[];
}

// ─── General Ledger ───────────────────────────────────────────────────────────

export type GLPeriod = "2026-01" | "2026-02" | "2026-03" | "2026-04" | "2026-05";

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface AccountLedgerEntryDto {
  date: string;
  entryNumber: string;
  reference?: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface AccountLedgerDto {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  from?: string | null;
  to?: string | null;
  openingBalance: number;
  entries: AccountLedgerEntryDto[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface GLSummaryDto {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  periods: GLPeriod[];
  accounts: number;
  currentPeriod: GLPeriod;
}

// ─── Journals ─────────────────────────────────────────────────────────────────

export type JournalStatus = "draft" | "posted" | "reversed" | "voided";

export interface JournalLineDto {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface JournalEntryDto {
  id: string;
  journalNumber: string;
  date: string;
  reference: string;
  description: string;
  status: JournalStatus;
  lines: JournalLineDto[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdBy: string;
  postedBy?: string;
  postedDate?: string;
  period: string;
}

export interface JournalsSummaryDto {
  total: number;
  draft: number;
  posted: number;
  reversed: number;
  totalPostedValue: number;
  thisMonth: number;
}

// ─── Tax / VAT ────────────────────────────────────────────────────────────────

export interface TaxPeriodDto {
  id: string;
  period: string;
  from: string;
  to: string;
  status: "open" | "filed" | "paid" | "overdue";
  outputVat: number;
  inputVat: number;
  netVat: number;
  dueDate: string;
  filedDate?: string;
  paidDate?: string;
  penalty?: number;
}

export interface TaxTransactionDto {
  id: string;
  date: string;
  type: "sale" | "purchase";
  reference: string;
  amount: number;
  vatAmount: number;
  vatRate: number;
  description: string;
  period: string;
}

export interface TaxSummaryDto {
  currentPeriodOutput: number;
  currentPeriodInput: number;
  currentNetVat: number;
  ytdVatPaid: number;
  nextDueDate: string;
  currentPeriod: string;
  registrationNumber: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface InvoiceItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceRequest {
  customerName: string;
  customerEmail?: string | null;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  notes?: string | null;
  items: InvoiceItemRequest[];
}

export interface UpdateInvoiceRequest {
  customerName: string;
  customerEmail?: string | null;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  notes?: string | null;
  status: string;
  items: InvoiceItemRequest[];
}

export interface CreateExpenseRequest {
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface JournalLineRequest {
  accountId: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
}

export interface CreateJournalEntryRequest {
  date: string;
  description: string;
  reference?: string | null;
  notes?: string | null;
  lines: JournalLineRequest[];
}

export interface BudgetLineRequest {
  category: string;
  accountName?: string | null;
  budgetedAmount: number;
}

export interface CreateBudgetRequest {
  name: string;
  period: string;
  notes?: string | null;
  lines: BudgetLineRequest[];
}

export interface CreateBankTransactionRequest {
  accountId: string;
  date: string;
  description: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  reference?: string | null;
  toAccountId?: string | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface StatementLine { accountCode: string; accountName: string; amount: number; }

export interface ProfitLossDto {
  from: string; to: string;
  revenue: StatementLine[]; totalRevenue: number;
  expenses: StatementLine[]; totalExpenses: number;
  netProfit: number;
}

export interface BalanceSheetDto {
  asOf: string;
  assets: StatementLine[]; totalAssets: number;
  liabilities: StatementLine[]; totalLiabilities: number;
  equity: StatementLine[]; retainedEarnings: number; totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface CashFlowDto {
  from: string; to: string;
  openingCash: number; inflows: number; outflows: number;
  netCashFlow: number; closingCash: number;
}

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringLineDto { id: string; description: string; quantity: number; unitPrice: number; }
export interface RecurringInvoiceDto {
  id: string;
  templateName: string;
  customerName: string;
  customerEmail?: string | null;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  dueDays: number;
  taxRate: number;
  notes?: string | null;
  isActive: boolean;
  lastGeneratedDate?: string | null;
  generatedCount: number;
  subTotal: number;
  total: number;
  lines: RecurringLineDto[];
}
export interface RecurringSummaryDto {
  total: number; active: number; dueSoon: number; generatedTotal: number; monthlyValue: number;
}
export interface UpsertRecurringRequest {
  templateName: string;
  customerName: string;
  customerEmail?: string | null;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  dueDays: number;
  taxRate: number;
  notes?: string | null;
  lines: { description: string; quantity: number; unitPrice: number }[];
}

function qsRange(from?: string, to?: string): string {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to)   qs.set("to", to);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const financeApi = {
  // Invoicing
  getInvoices:       (): Promise<InvoiceDto[]>               => rawApiClient.get(`${BASE}/invoices`),
  getInvoiceSummary: (): Promise<InvoiceSummaryDto>          => rawApiClient.get(`${BASE}/invoices/summary`),
  getInvoiceById:    (id: string): Promise<InvoiceDetailDto> => rawApiClient.get(`${BASE}/invoices/${id}`),
  createInvoice:     (data: CreateInvoiceRequest): Promise<InvoiceDto> => rawApiClient.post(`${BASE}/invoices`, data),
  updateInvoice:     (id: string, data: UpdateInvoiceRequest): Promise<void> => rawApiClient.put(`${BASE}/invoices/${id}`, data),
  deleteInvoice:     (id: string): Promise<void>             => rawApiClient.delete(`${BASE}/invoices/${id}`),
  sendInvoice:       (id: string): Promise<void>             => rawApiClient.post(`${BASE}/invoices/${id}/send`),
  markInvoicePaid:   (id: string): Promise<void>             => rawApiClient.post(`${BASE}/invoices/${id}/pay`),
  cancelInvoice:     (id: string): Promise<void>             => rawApiClient.post(`${BASE}/invoices/${id}/cancel`),

  // Accounting
  getAccounts: (params?: { search?: string; accountType?: string; isActive?: boolean }): Promise<AccountDto[]> => {
    const qs = new URLSearchParams();
    if (params?.search)                      qs.set("search",      params.search);
    if (params?.accountType)                 qs.set("accountType", params.accountType);
    if (params?.isActive !== undefined)      qs.set("isActive",    String(params.isActive));
    const query = qs.toString();
    return rawApiClient.get(`${BASE}/accounts${query ? `?${query}` : ""}`);
  },
  getAccountingSummary: (): Promise<AccountingSummaryDto>   => rawApiClient.get(`${BASE}/accounts/summary`),
  getAccountById:       (id: string): Promise<AccountDto>   => rawApiClient.get(`${BASE}/accounts/${id}`),
  createAccount:  (data: CreateAccountRequest): Promise<AccountDto>  => rawApiClient.post(`${BASE}/accounts`, data),
  updateAccount:  (id: string, data: UpdateAccountRequest): Promise<void> => rawApiClient.put(`${BASE}/accounts/${id}`, data),
  deleteAccount:  (id: string): Promise<void>                => rawApiClient.delete(`${BASE}/accounts/${id}`),

  // Banking
  getBankAccounts:        (): Promise<BankAccountDto[]>     => rawApiClient.get(`${BASE}/banking/accounts`),
  getBankTransactions:    (): Promise<BankTransactionDto[]> => rawApiClient.get(`${BASE}/banking/transactions`),
  getBankingSummary:      (): Promise<BankingSummaryDto>    => rawApiClient.get(`${BASE}/banking/summary`),
  createBankTransaction:  (data: CreateBankTransactionRequest): Promise<unknown> => rawApiClient.post(`${BASE}/banking/transactions`, data),
  reconcileTransaction:   (id: string): Promise<void> => rawApiClient.post(`${BASE}/banking/transactions/${id}/reconcile`),

  // Budgeting
  getBudgets:          (): Promise<BudgetDto[]>          => rawApiClient.get(`${BASE}/budgets`),
  getBudgetingSummary: (): Promise<BudgetingSummaryDto>  => rawApiClient.get(`${BASE}/budgets/summary`),
  createBudget:        (data: CreateBudgetRequest): Promise<BudgetDto> => rawApiClient.post(`${BASE}/budgets`, data),

  // Suppliers
  getSuppliers: (params?: { search?: string; isActive?: boolean }): Promise<SupplierDto[]> => {
    const qs = new URLSearchParams();
    if (params?.search)                 qs.set("search",   params.search);
    if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
    const query = qs.toString();
    return rawApiClient.get(`${BASE}/suppliers${query ? `?${query}` : ""}`);
  },

  // Purchase Bills (AP Invoices)
  getPurchaseBills: (params?: { page?: number; pageSize?: number; search?: string; status?: string; supplierId?: string; outstanding?: boolean }): Promise<PagedResult<PurchaseBillSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params?.page)                     qs.set("page",        String(params.page));
    if (params?.pageSize)                 qs.set("pageSize",    String(params.pageSize));
    if (params?.search)                   qs.set("search",      params.search);
    if (params?.status)                   qs.set("status",      params.status);
    if (params?.supplierId)               qs.set("supplierId",  params.supplierId);
    if (params?.outstanding !== undefined) qs.set("outstanding", String(params.outstanding));
    const query = qs.toString();
    return rawApiClient.get(`${BASE}/purchase-bills${query ? `?${query}` : ""}`);
  },
  getPurchaseBillsSummary: (): Promise<PurchaseBillsSummaryDto> => rawApiClient.get(`${BASE}/purchase-bills/summary`),
  getPurchaseBillById:     (id: string): Promise<PurchaseBillDto> => rawApiClient.get(`${BASE}/purchase-bills/${id}`),
  createPurchaseBill:      (data: CreatePurchaseBillRequest): Promise<PurchaseBillDto> => rawApiClient.post(`${BASE}/purchase-bills`, data),
  approvePurchaseBill:     (id: string): Promise<void> => rawApiClient.post(`${BASE}/purchase-bills/${id}/approve`),
  cancelPurchaseBill:      (id: string): Promise<void> => rawApiClient.post(`${BASE}/purchase-bills/${id}/cancel`),
  deletePurchaseBill:      (id: string): Promise<void> => rawApiClient.delete(`${BASE}/purchase-bills/${id}`),

  // Expenses
  getExpenses:         (): Promise<ExpenseDto[]>         => rawApiClient.get(`${BASE}/expenses`),
  getExpensesSummary:  (): Promise<ExpensesSummaryDto>   => rawApiClient.get(`${BASE}/expenses/summary`),
  createExpense:       (data: CreateExpenseRequest): Promise<ExpenseDto> => rawApiClient.post(`${BASE}/expenses`, data),
  approveExpense:      (id: string, approverId: string): Promise<void> => rawApiClient.post(`${BASE}/expenses/${id}/approve`, { approverId }),
  rejectExpense:       (id: string, approverId: string): Promise<void> => rawApiClient.post(`${BASE}/expenses/${id}/reject`, { approverId }),
  payExpense:          (id: string): Promise<void> => rawApiClient.post(`${BASE}/expenses/${id}/pay`),

  // General Ledger
  getTrialBalance: (): Promise<TrialBalanceLine[]> => rawApiClient.get(`${BASE}/gl/trial-balance`),
  getGLSummary:    (): Promise<GLSummaryDto>       => rawApiClient.get(`${BASE}/gl/summary`),
  getAccountLedger: (accountId: string, from?: string, to?: string): Promise<AccountLedgerDto> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return rawApiClient.get(`${BASE}/gl/accounts/${accountId}/ledger${query ? `?${query}` : ""}`);
  },

  // Financial statements
  getProfitLoss:   (from?: string, to?: string): Promise<ProfitLossDto> =>
    rawApiClient.get(`${BASE}/gl/profit-loss${qsRange(from, to)}`),
  getBalanceSheet: (asOf?: string): Promise<BalanceSheetDto> =>
    rawApiClient.get(`${BASE}/gl/balance-sheet${asOf ? `?asOf=${asOf}` : ""}`),
  getCashFlow:     (from?: string, to?: string): Promise<CashFlowDto> =>
    rawApiClient.get(`${BASE}/gl/cash-flow${qsRange(from, to)}`),

  // Journals
  getJournals:         (): Promise<JournalEntryDto[]>   => rawApiClient.get(`${BASE}/journals`),
  getJournalsSummary:  (): Promise<JournalsSummaryDto>  => rawApiClient.get(`${BASE}/journals/summary`),
  createJournalEntry:  (data: CreateJournalEntryRequest): Promise<unknown> => rawApiClient.post(`${BASE}/journal-entries`, data),
  postJournalEntry:    (id: string): Promise<void> => rawApiClient.post(`${BASE}/journal-entries/${id}/post`),
  voidJournalEntry:    (id: string): Promise<void> => rawApiClient.post(`${BASE}/journal-entries/${id}/void`),

  // Tax / VAT
  getTaxPeriods:       (): Promise<TaxPeriodDto[]>      => rawApiClient.get(`${BASE}/tax/periods`),
  getTaxTransactions:  (): Promise<TaxTransactionDto[]> => rawApiClient.get(`${BASE}/tax/transactions`),
  getTaxSummary:       (): Promise<TaxSummaryDto>       => rawApiClient.get(`${BASE}/tax/summary`),
  fileTaxPeriod:       (id: string): Promise<void> => rawApiClient.post(`${BASE}/tax/periods/${id}/file`),
  payTaxPeriod:        (id: string): Promise<void> => rawApiClient.post(`${BASE}/tax/periods/${id}/pay`),

  // Recurring invoices
  getRecurringInvoices:   (): Promise<RecurringInvoiceDto[]> => rawApiClient.get(`${BASE}/recurring-invoices`),
  getRecurringSummary:    (): Promise<RecurringSummaryDto>   => rawApiClient.get(`${BASE}/recurring-invoices/summary`),
  createRecurringInvoice: (data: UpsertRecurringRequest): Promise<RecurringInvoiceDto> => rawApiClient.post(`${BASE}/recurring-invoices`, data),
  updateRecurringInvoice: (id: string, data: UpsertRecurringRequest): Promise<void> => rawApiClient.put(`${BASE}/recurring-invoices/${id}`, data),
  deleteRecurringInvoice: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/recurring-invoices/${id}`),
  pauseRecurringInvoice:  (id: string): Promise<void> => rawApiClient.post(`${BASE}/recurring-invoices/${id}/pause`),
  resumeRecurringInvoice: (id: string): Promise<void> => rawApiClient.post(`${BASE}/recurring-invoices/${id}/resume`),
  generateRecurringNow:   (id: string): Promise<{ invoiceId: string; invoiceNumber: string }> => rawApiClient.post(`${BASE}/recurring-invoices/${id}/generate`),
  runDueRecurring:        (): Promise<{ generated: number }> => rawApiClient.post(`${BASE}/recurring-invoices/run-due`),
};
