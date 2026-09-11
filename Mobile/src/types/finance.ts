/**
 * Trimmed mirror of Softaxis.Finance.Application.{Invoices,Expenses}.Dtos DTOs. v1 scope:
 * invoices read + Send/Mark Paid; expenses read + submit a new claim (approve/reject already
 * lives in the cross-module Approvals inbox -- ApprovalsScreen.tsx -- not duplicated here).
 */
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceSummaryDto {
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
  currencyCode: string;
  status: InvoiceStatus;
  scheduledSendDate?: string | null;
  remindBeforeDue: boolean;
  itemCount: number;
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface InvoiceDto {
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
  currencyCode: string;
  status: InvoiceStatus;
  notes?: string | null;
  ccEmails?: string | null;
  scheduledSendDate?: string | null;
  remindBeforeDue: boolean;
  lastReminderSentAt?: string | null;
  items: InvoiceItemDto[];
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  customerAddress?: string | null;
  customerTrn?: string | null;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  partial: "Partially paid",
};

/** Badge tone per status -- consumed by <Badge tone={...}>. */
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  overdue: "destructive",
  cancelled: "neutral",
  partial: "warning",
};

export interface InvoicesPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

// ── Expenses ────────────────────────────────────────────────────────────────────────────────
export type ExpenseStatus = "draft" | "pending" | "approved" | "rejected" | "paid";
export type ExpenseCategory =
  | "travel"
  | "accommodation"
  | "meals"
  | "fuel"
  | "software"
  | "office"
  | "training"
  | "medical"
  | "other";

export interface ExpenseDto {
  id: string;
  expenseNumber: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  status: ExpenseStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  hasReceipt: boolean;
  receiptFileName?: string | null;
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

/** Badge tone per status -- consumed by <Badge tone={...}>. */
export const EXPENSE_STATUS_TONE: Record<ExpenseStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  paid: "info",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "travel",
  "accommodation",
  "meals",
  "fuel",
  "software",
  "office",
  "training",
  "medical",
  "other",
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel: "Travel",
  accommodation: "Accommodation",
  meals: "Meals",
  fuel: "Fuel",
  software: "Software",
  office: "Office",
  training: "Training",
  medical: "Medical",
  other: "Other",
};

export interface ExpensesPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
}

export interface CreateExpensePayload {
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}
