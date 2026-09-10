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
};
