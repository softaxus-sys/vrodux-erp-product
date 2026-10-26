export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: { mfaToken: string; email: string };
};

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string; leadName: string };
  LeadForm: { leadId?: string } | undefined;
  LeadReassign: { leadId: string; leadName: string };
  AccountsList: undefined;
  AccountForm: { accountId?: string };
};

export type DealsStackParamList = {
  DealsList: undefined;
  DealDetail: { dealId: string; dealTitle: string };
  DealForm: { dealId?: string } | undefined;
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
  NewEmployee: undefined;
  MarkAttendance: undefined;
};

export type InventoryStackParamList = {
  ProductsList: undefined;
  ProductDetail: { productId: string; productName: string };
  BarcodeScanner: undefined;
  StockAdjust: { productId: string; productName: string };
  NewProduct: undefined;
  TransfersList: undefined;
  NewTransfer: undefined;
};

export type SalesStackParamList = {
  SalesHome: undefined;
  OrdersList: undefined;
  OrderDetail: { orderId: string; orderNumber: string };
  QuotationsList: undefined;
  QuotationDetail: { quotationId: string; quotationNumber: string };
  NewOrder: undefined;
  NewQuotation: undefined;
};

export type PurchaseStackParamList = {
  PurchaseHome: undefined;
  PurchaseOrdersList: undefined;
  PurchaseOrderDetail: { orderId: string; orderNumber: string };
  ReceiveOrder: { orderId: string; orderNumber: string };
  VendorsList: undefined;
  VendorDetail: { vendorId: string; vendorName: string };
  NewPurchaseOrder: undefined;
  VendorForm: { vendorId?: string } | undefined;
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  InvoicesList: undefined;
  InvoiceDetail: { invoiceId: string; invoiceNumber: string };
  ExpensesList: undefined;
  ExpenseDetail: { expenseId: string; expenseNumber: string };
  NewExpense: undefined;
  NewInvoice: undefined;
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
  OpenShift: undefined;
  CloseShift: { sessionId: string };
  NewSale: { sessionId: string };
  TransactionAction: { transactionId: string; mode: "void" | "refund" };
  CashMovement: { sessionId: string };
  BranchStock: undefined;
};

export type RestaurantStackParamList = {
  RestaurantHome: undefined;
  TablesList: undefined;
  OrdersList: undefined;
  // Restaurant orders and Sales orders are unrelated resources sharing a route name within their
  // own stacks (each `Stack.Navigator` has its own param-list namespace) -- same "OrderDetail"
  // name as SalesStackParamList above, not a collision. orderNumber is optional because
  // TablesListScreen navigates straight from a table's currentOrderId, which carries no number.
  OrderDetail: { orderId: string; orderNumber?: string };
  // With orderId set, this screen operates in "add items to an existing order" mode instead of
  // creating a new one -- one screen, one cart implementation, rather than two that could drift.
  NewOrder: { tableId?: string; tableNumber?: string; orderId?: string; orderNumber?: string };
  KitchenTickets: undefined;
  ReservationsList: undefined;
  WaitlistList: undefined;
  DeliveryOrdersList: undefined;
  DeliveryOrderDetail: { deliveryOrderId: string; orderNumber: string };
};

export type VisaStackParamList = {
  VisaHome: undefined;
  CasesList: undefined;
  CaseDetail: { caseId: string; caseNumber: string };
  RenewalsList: undefined;
  NewCase: undefined;
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
  NewListing: undefined;
  NewTenant: undefined;
  NewLease: undefined;
  BrokersList: undefined;
  // No GET /brokers/{id} exists on the backend either -- same reasoning as TenantDetail above.
  BrokerDetail: { broker: import("@/types/real-estate").BrokerDto };
};

export type ReportsStackParamList = {
  ReportsHub: undefined;
  ReportRunner: { reportId: string };
};

// ── Industry verticals -- read-only browse, no detail screens (see README for what's deferred
// in each). B2B/Education/Healthcare/Insurance share an identical 3-sub-feature shape (all in the
// CRM assembly); Construction and Hospitality are their own microservices.

export type B2BStackParamList = {
  B2BHome: undefined;
  ProposalsList: undefined;
  ContractsList: undefined;
  TicketsList: undefined;  VerticalForm: { formKey: string };
};

export type EducationStackParamList = {
  EducationHome: undefined;
  AdmissionsList: undefined;
  StudentsList: undefined;
  EnrollmentsList: undefined;  VerticalForm: { formKey: string };
};

export type HealthcareStackParamList = {
  HealthcareHome: undefined;
  PatientsList: undefined;
  AppointmentsList: undefined;
  TreatmentPlansList: undefined;  VerticalForm: { formKey: string };
};

export type InsuranceStackParamList = {
  InsuranceHome: undefined;
  PoliciesList: undefined;
  RenewalsList: undefined;
  ClaimsList: undefined;  VerticalForm: { formKey: string };
};

export type ConstructionStackParamList = {
  ConstructionHome: undefined;
  ProjectsList: undefined;
  SitesList: undefined;
  ContractorsList: undefined;
  BoqsList: undefined;
};

export type HospitalityStackParamList = {
  HospitalityHome: undefined;
  RoomsList: undefined;
  BookingsList: undefined;
  HousekeepingList: undefined;
  NewBooking: undefined;
  ToursHome: undefined;
  TourBookingsList: undefined;
  TourBookingDetail: { bookingId: string; bookingNumber: string };
  TourPackages: undefined;
};

export type ExtraStackParamList = {
  ModuleHome: { moduleKey: string };
  ModuleList: { listKey: string };
  RecordDetail: { listKey: string; record: Record<string, any> };
  VerticalForm: { formKey: string };
  LibraryDesk: undefined;
  NewEvent: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Library: undefined;
  Manufacturing: undefined;
  Trade: undefined;
  Recipe: undefined;
  Calendar: undefined;
  Support: undefined;
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
  B2B: undefined;
  Education: undefined;
  Healthcare: undefined;
  Insurance: undefined;
  Construction: undefined;
  Hospitality: undefined;
  Reports: undefined;
  /** A single screen, not a stack -- same as Approvals (no per-record navigation, everything the
   *  screen shows is scoped from the session's own access already). */
  FileManager: undefined;
  /** Also a single screen -- the signed-in user's own account (profile/password/2FA), gated on
   *  nothing at all, so every session sees it regardless of module subscriptions. */
  Settings: undefined;
  /** Only registered when a session has more module tabs than fit in the bar -- see
   *  `navigation/tab-config.ts`. Houses whatever didn't fit as its own MenuCard list. */
  More: undefined;
};
