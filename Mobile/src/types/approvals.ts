/**
 * Cross-module "approvals inbox" -- aggregates the four independent approval workflows this
 * backend already has (HR leave requests, HR payroll runs, Purchase requisitions, Sales returns)
 * into one feed. There is no backend endpoint that unions these; each type below is a trimmed
 * mirror of that service's own controller DTO (see approvals.api.ts for the exact routes).
 */

// ── HR: leave requests (LeavesController, not the self-service api/hr/me/leaves) ──────────────
export interface PendingLeaveDto {
  id: string;
  leaveNumber: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
  status: string;
  createdAt: string;
}

// ── Purchase: requisitions (ApprovalsController) ───────────────────────────────────────────────
export interface PendingPurchaseApprovalDto {
  id: string;
  requestNumber: string;
  title: string;
  requestedBy: string;
  department: string;
  requiredBy: string;
  status: string;
  priority: string;
  totalAmount: number;
  currency: string;
  justification: string;
  createdAt: string;
}

// ── Sales: returns (SalesReturnsController) ────────────────────────────────────────────────────
export interface PendingSalesReturnDto {
  id: string;
  returnNumber: string;
  orderNumber: string;
  customerName: string;
  requestDate: string;
  status: string;
  reason: string;
  reasonDetail: string;
  refundAmount: number;
  currency: string;
  createdAt: string;
}

// ── HR: payroll runs (PayrollController) -- a run needing HR to process/pay, or Finance to
//    sign off, depending on which permission the caller holds. ────────────────────────────────
export type PayrollActionKind = "process" | "finance-approve" | "pay";

export interface PendingPayrollRunDto {
  id: string;
  runNumber: string;
  period: string;
  status: string;
  totalNetSalary: number;
  slipCount: number;
  createdByName?: string | null;
}

/** One row in the unified inbox -- the screen renders on `kind`, actions post to the matching API. */
export type ApprovalItem =
  | { kind: "leave"; data: PendingLeaveDto }
  | { kind: "purchase"; data: PendingPurchaseApprovalDto }
  | { kind: "sales-return"; data: PendingSalesReturnDto }
  | { kind: "payroll"; data: PendingPayrollRunDto; action: PayrollActionKind };
