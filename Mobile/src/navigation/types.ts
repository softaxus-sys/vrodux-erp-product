export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: { mfaToken: string; email: string };
};

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string; leadName: string };
};

export type DealsStackParamList = {
  DealsList: undefined;
  DealDetail: { dealId: string; dealTitle: string };
};

export type HrStackParamList = {
  HrHome: undefined;
  Attendance: undefined;
  Leave: undefined;
  Payslips: undefined;
  EmployeesList: undefined;
  EmployeeDetail: { employeeId: string; employeeName: string };
  DepartmentsList: undefined;
  JobPostingsList: undefined;
  JobPostingDetail: { jobId: string; jobTitle: string };
  ApplicantDetail: { applicantId: string; applicantName: string };
  PerformanceReviewsList: undefined;
  PerformanceReviewDetail: { reviewId: string; employeeName: string };
};

export type InventoryStackParamList = {
  ProductsList: undefined;
  ProductDetail: { productId: string; productName: string };
};

export type SalesStackParamList = {
  SalesHome: undefined;
  OrdersList: undefined;
  OrderDetail: { orderId: string; orderNumber: string };
  QuotationsList: undefined;
  QuotationDetail: { quotationId: string; quotationNumber: string };
};

export type PurchaseStackParamList = {
  PurchaseHome: undefined;
  PurchaseOrdersList: undefined;
  PurchaseOrderDetail: { orderId: string; orderNumber: string };
  VendorsList: undefined;
  VendorDetail: { vendorId: string; vendorName: string };
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  InvoicesList: undefined;
  InvoiceDetail: { invoiceId: string; invoiceNumber: string };
  ExpensesList: undefined;
  ExpenseDetail: { expenseId: string; expenseNumber: string };
  NewExpense: undefined;
  AccountsList: undefined;
  BankAccountsList: undefined;
  BankAccountDetail: { accountId: string; accountName: string };
  BudgetsList: undefined;
  JournalsList: undefined;
  // No GET /{id} exists for either -- the list DTO already carries everything the detail screen
  // shows (journals embed lines[]; recurring invoices embed lines[]), so the whole row is passed
  // through nav params instead of a second, nonexistent, fetch.
  JournalDetail: { journal: import("@/types/finance-ledger").JournalEntryDto };
  TaxPeriodsList: undefined;
  TaxPeriodDetail: { period: string; periodLabel: string };
  RecurringInvoicesList: undefined;
  RecurringInvoiceDetail: { recurring: import("@/types/finance-ledger").RecurringInvoiceDto };
};

export type AppTabParamList = {
  Dashboard: undefined;
  Leads: undefined;
  Pipeline: undefined;
  HR: undefined;
  Approvals: undefined;
  Inventory: undefined;
  Sales: undefined;
  Purchase: undefined;
  Finance: undefined;
  /** Only registered when a session has more module tabs than fit in the bar -- see
   *  `navigation/tab-config.ts`. Houses whatever didn't fit as its own MenuCard list. */
  More: undefined;
};
