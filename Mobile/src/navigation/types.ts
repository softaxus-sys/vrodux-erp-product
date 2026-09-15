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

export type ProjectManagementStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string; projectName: string };
  Board: { projectId: string; projectName: string };
  Backlog: { projectId: string; projectName: string };
  IssuesList: { projectId: string; projectName: string };
  IssueDetail: { issueId: string; issueKey: string };
  ProjectMembers: { projectId: string; projectName: string };
};

export type POSStackParamList = {
  POSHome: undefined;
  POSSessionDetail: { sessionId: string; registerId: string };
  POSTransactionsList: undefined;
  POSTransactionDetail: { transactionId: string; transactionNumber: string };
};

export type RestaurantStackParamList = {
  RestaurantHome: undefined;
  TablesList: undefined;
  OrdersList: undefined;
  // Restaurant orders and Sales orders are unrelated resources sharing a route name within their
  // own stacks (each `Stack.Navigator` has its own param-list namespace) -- same "OrderDetail"
  // name as SalesStackParamList above, not a collision.
  OrderDetail: { orderId: string; orderNumber: string };
  KitchenTickets: undefined;
  ReservationsList: undefined;
  WaitlistList: undefined;
};

export type VisaStackParamList = {
  VisaHome: undefined;
  CasesList: undefined;
  CaseDetail: { caseId: string; caseNumber: string };
  RenewalsList: undefined;
};

export type RealEstateStackParamList = {
  RealEstateHome: undefined;
  PropertiesList: undefined;
  PropertyDetail: { propertyId: string; propertyName: string };
  UnitsList: undefined;
  TenantsList: undefined;
  // No GET /tenants/{id} exists on the backend -- the list DTO already carries every field the
  // detail screen shows, so the whole row is passed through nav params instead of a second,
  // nonexistent, fetch (same pattern as FinanceStackParamList's JournalDetail/RecurringInvoiceDetail).
  TenantDetail: { tenant: import("@/types/real-estate").TenantDto };
  ContractsList: undefined;
  ContractDetail: { contractId: string; contractNumber: string };
  RentDue: undefined;
  BrokersList: undefined;
  // No GET /brokers/{id} exists on the backend either -- same reasoning as TenantDetail above.
  BrokerDetail: { broker: import("@/types/real-estate").BrokerDto };
};

export type ReportsStackParamList = {
  ReportsHub: undefined;
  ReportRunner: { reportId: string };
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
  Projects: undefined;
  POS: undefined;
  Restaurant: undefined;
  Visa: undefined;
  RealEstate: undefined;
  Reports: undefined;
  /** A single screen, not a stack -- same as Approvals (no per-record navigation, everything the
   *  screen shows is scoped from the session's own access already). */
  FileManager: undefined;
  /** Only registered when a session has more module tabs than fit in the bar -- see
   *  `navigation/tab-config.ts`. Houses whatever didn't fit as its own MenuCard list. */
  More: undefined;
};
