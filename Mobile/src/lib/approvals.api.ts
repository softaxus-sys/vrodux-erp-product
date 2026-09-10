import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  PendingLeaveDto,
  PendingPayrollRunDto,
  PendingPurchaseApprovalDto,
  PendingSalesReturnDto,
} from "@/types/approvals";

/** Permission keys that make each source of the approvals inbox actionable. Mirrors each
 *  controller's [RequirePermission]/[RequireAnyPermission] on its approve/process action. */
export const APPROVALS_HR_LEAVES = "hr.leaves.approve";
export const APPROVALS_PURCHASE = "purchase.approvals.approve";
export const APPROVALS_SALES_RETURNS = "sales.returns.approve";
export const APPROVALS_HR_PAYROLL = "hr.payroll.approve";
export const APPROVALS_FINANCE_PAYROLL = "finance.payroll.approve";

// ── HR leave requests ───────────────────────────────────────────────────────────────────────
export const hrLeaveApprovalsApi = {
  getPending: (): Promise<PagedResult<PendingLeaveDto>> =>
    apiClient.get(`/api/hr/leaves?status=pending&pageSize=50`),

  /** Backend takes { approverId, notes } -- approverId is the signed-in user's own id. */
  approve: (id: string, approverId: string): Promise<void> =>
    apiClient.post(`/api/hr/leaves/${id}/approve`, { approverId, notes: null }),

  reject: (id: string, approverId: string, notes?: string): Promise<void> =>
    apiClient.post(`/api/hr/leaves/${id}/reject`, { approverId, notes: notes ?? null }),
};

// ── Purchase requisitions ───────────────────────────────────────────────────────────────────
export const purchaseApprovalsApi = {
  // No status query param on this endpoint -- filter client-side (Purchase's ApprovalsController
  // has no [FromQuery] filters, per src/Services/Purchase/.../Controllers/ApprovalsController.cs).
  getAll: (): Promise<PendingPurchaseApprovalDto[]> => apiClient.get(`/api/purchase/approvals`),

  approve: (id: string, by: string): Promise<void> =>
    apiClient.post(`/api/purchase/approvals/${id}/approve`, { by }),

  reject: (id: string, by: string, reason: string): Promise<void> =>
    apiClient.post(`/api/purchase/approvals/${id}/reject`, { by, reason }),
};

// ── Sales returns ───────────────────────────────────────────────────────────────────────────
export const salesReturnApprovalsApi = {
  // Same shape as Purchase's -- no status filter on the endpoint.
  getAll: (): Promise<PendingSalesReturnDto[]> => apiClient.get(`/api/sales/returns`),

  approve: (id: string, by: string): Promise<void> =>
    apiClient.post(`/api/sales/returns/${id}/approve`, { by }),

  // No reason field on this endpoint's reject -- SalesReturnsController reuses ActionRequest(By).
  reject: (id: string, by: string): Promise<void> =>
    apiClient.post(`/api/sales/returns/${id}/reject`, { by }),
};

// ── HR payroll runs (process by HR, sign-off by Finance, pay by HR again) ──────────────────────
export const payrollApprovalsApi = {
  // hr.payroll.view OR finance.payroll.approve both satisfy this list endpoint, so a
  // Finance-only approver can still see the runs they need to act on.
  getRuns: (): Promise<PagedResult<PendingPayrollRunDto>> => apiClient.get(`/api/hr/payroll?pageSize=100`),

  process: (id: string): Promise<void> => apiClient.post(`/api/hr/payroll/${id}/process`),
  pay: (id: string): Promise<void> => apiClient.post(`/api/hr/payroll/${id}/pay`),
  financeApprove: (id: string): Promise<void> => apiClient.post(`/api/hr/payroll/${id}/finance-approve`),
  reject: (id: string, reason?: string): Promise<void> =>
    apiClient.post(`/api/hr/payroll/${id}/reject`, { reason: reason ?? null }),
};
