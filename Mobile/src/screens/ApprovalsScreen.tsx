import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  useApproveLeave,
  useApprovePurchase,
  useApproveSalesReturn,
  useFinanceApprovePayroll,
  usePayPayroll,
  usePayrollRunsForApproval,
  usePendingLeaves,
  usePendingPurchaseApprovals,
  usePendingSalesReturns,
  useProcessPayroll,
  useRejectLeave,
  useRejectPayroll,
  useRejectPurchase,
  useRejectSalesReturn,
} from "@/hooks/use-approvals";
import {
  APPROVALS_FINANCE_PAYROLL,
  APPROVALS_HR_LEAVES,
  APPROVALS_HR_PAYROLL,
  APPROVALS_PURCHASE,
  APPROVALS_SALES_RETURNS,
} from "@/lib/approvals.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasModuleAccess, hasPermission, useAuthStore } from "@/store/auth.store";
import type {
  PayrollActionKind,
  PendingLeaveDto,
  PendingPayrollRunDto,
  PendingPurchaseApprovalDto,
  PendingSalesReturnDto,
} from "@/types/approvals";

function titleCase(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAYROLL_ACTION_LABEL: Record<PayrollActionKind, string> = {
  process: "Process",
  "finance-approve": "Approve",
  pay: "Mark Paid",
};

export default function ApprovalsScreen() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const approverId = user?.id ?? "";
  const approverName = user?.fullName ?? "";
  // PendingPayrollRunDto carries no currency of its own -- payroll is always recorded in the
  // tenant's operating currency (CLAUDE.md Module 6e/50), so read it off the session claims.
  const payrollCurrency = tenant?.currency ?? "";

  const canLeaves = hasModuleAccess("hr") && hasPermission(APPROVALS_HR_LEAVES);
  const canPurchase = hasModuleAccess("purchase") && hasPermission(APPROVALS_PURCHASE);
  const canSalesReturns = hasModuleAccess("sales") && hasPermission(APPROVALS_SALES_RETURNS);
  const canProcessOrPay = hasModuleAccess("hr") && hasPermission(APPROVALS_HR_PAYROLL);
  const canFinanceApprove = hasPermission(APPROVALS_FINANCE_PAYROLL);
  const canPayroll = canProcessOrPay || canFinanceApprove;

  const leaves = usePendingLeaves(canLeaves);
  const purchase = usePendingPurchaseApprovals(canPurchase);
  const salesReturns = usePendingSalesReturns(canSalesReturns);
  const payroll = usePayrollRunsForApproval(canPayroll);

  // Which action (if any) the caller's own permissions let them take on each run, derived from
  // its status -- mirrors the backend status machine (draft -> processed -> finance_approved ->
  // paid) documented in PayrollController / CLAUDE.md Module 44.
  const payrollActions = useMemo(() => {
    const runs = payroll.data?.items ?? [];
    const out: { run: PendingPayrollRunDto; action: PayrollActionKind }[] = [];
    for (const run of runs) {
      if (canProcessOrPay && run.status === "draft") out.push({ run, action: "process" });
      else if (canFinanceApprove && run.status === "processed") out.push({ run, action: "finance-approve" });
      else if (canProcessOrPay && run.status === "finance_approved") out.push({ run, action: "pay" });
    }
    return out;
  }, [payroll.data, canProcessOrPay, canFinanceApprove]);

  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const approvePurchase = useApprovePurchase();
  const rejectPurchase = useRejectPurchase();
  const approveReturn = useApproveSalesReturn();
  const rejectReturn = useRejectSalesReturn();
  const processPayroll = useProcessPayroll();
  const payPayroll = usePayPayroll();
  const financeApprovePayroll = useFinanceApprovePayroll();
  const rejectPayroll = useRejectPayroll();

  const refreshing =
    (canLeaves && leaves.isRefetching) ||
    (canPurchase && purchase.isRefetching) ||
    (canSalesReturns && salesReturns.isRefetching) ||
    (canPayroll && payroll.isRefetching);

  function refreshAll() {
    if (canLeaves) leaves.refetch();
    if (canPurchase) purchase.refetch();
    if (canSalesReturns) salesReturns.refetch();
    if (canPayroll) payroll.refetch();
  }

  if (!canLeaves && !canPurchase && !canSalesReturns && !canPayroll) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Nothing to approve</Text>
        <Text style={styles.emptyText}>You don&apos;t hold an approval permission in any module yet.</Text>
      </View>
    );
  }

  const stillLoading = leaves.isLoading || purchase.isLoading || salesReturns.isLoading || payroll.isLoading;
  const totalPending =
    (leaves.data?.items.length ?? 0) + (purchase.data?.length ?? 0) + (salesReturns.data?.length ?? 0) + payrollActions.length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
    >
      {!stillLoading && totalPending === 0 ? (
        <Text style={styles.allClear}>You&apos;re all caught up. Nothing is waiting on you.</Text>
      ) : null}

      {canLeaves ? (
        <Section title="Leave requests" count={leaves.data?.items.length}>
          {leaves.isLoading ? (
            <ActivityIndicator />
          ) : leaves.isError ? (
            <ErrorRetry onRetry={() => leaves.refetch()} />
          ) : !leaves.data || leaves.data.items.length === 0 ? (
            <Text style={styles.emptySection}>No pending leave requests.</Text>
          ) : (
            leaves.data.items.map((l) => (
              <LeaveRow
                key={l.id}
                leave={l}
                approving={approveLeave.isPending}
                rejecting={rejectLeave.isPending}
                onApprove={() => approveLeave.mutate({ id: l.id, approverId })}
                onReject={(notes) => rejectLeave.mutate({ id: l.id, approverId, notes })}
              />
            ))
          )}
        </Section>
      ) : null}

      {canPurchase ? (
        <Section title="Purchase requisitions" count={purchase.data?.length}>
          {purchase.isLoading ? (
            <ActivityIndicator />
          ) : purchase.isError ? (
            <ErrorRetry onRetry={() => purchase.refetch()} />
          ) : !purchase.data || purchase.data.length === 0 ? (
            <Text style={styles.emptySection}>No pending requisitions.</Text>
          ) : (
            purchase.data.map((p) => (
              <PurchaseRow
                key={p.id}
                item={p}
                approving={approvePurchase.isPending}
                rejecting={rejectPurchase.isPending}
                onApprove={() => approvePurchase.mutate({ id: p.id, by: approverName })}
                onReject={(reason) => rejectPurchase.mutate({ id: p.id, by: approverName, reason })}
              />
            ))
          )}
        </Section>
      ) : null}

      {canSalesReturns ? (
        <Section title="Sales returns" count={salesReturns.data?.length}>
          {salesReturns.isLoading ? (
            <ActivityIndicator />
          ) : salesReturns.isError ? (
            <ErrorRetry onRetry={() => salesReturns.refetch()} />
          ) : !salesReturns.data || salesReturns.data.length === 0 ? (
            <Text style={styles.emptySection}>No pending returns.</Text>
          ) : (
            salesReturns.data.map((r) => (
              <SalesReturnRow
                key={r.id}
                item={r}
                approving={approveReturn.isPending}
                rejecting={rejectReturn.isPending}
                onApprove={() => approveReturn.mutate({ id: r.id, by: approverName })}
                onReject={() => rejectReturn.mutate({ id: r.id, by: approverName })}
              />
            ))
          )}
        </Section>
      ) : null}

      {canPayroll ? (
        <Section title="Payroll runs" count={payrollActions.length}>
          {payroll.isLoading ? (
            <ActivityIndicator />
          ) : payroll.isError ? (
            <ErrorRetry onRetry={() => payroll.refetch()} />
          ) : payrollActions.length === 0 ? (
            <Text style={styles.emptySection}>No payroll runs waiting on you.</Text>
          ) : (
            payrollActions.map(({ run, action }) => (
              <PayrollRow
                key={run.id}
                run={run}
                action={action}
                currency={payrollCurrency}
                busy={processPayroll.isPending || payPayroll.isPending || financeApprovePayroll.isPending}
                rejecting={rejectPayroll.isPending}
                onAct={() => {
                  if (action === "process") processPayroll.mutate(run.id);
                  else if (action === "pay") payPayroll.mutate(run.id);
                  else financeApprovePayroll.mutate(run.id);
                }}
                onReject={
                  action === "pay" ? undefined : (reason) => rejectPayroll.mutate({ id: run.id, reason })
                }
              />
            ))
          )}
        </Section>
      ) : null}
    </ScrollView>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────────────────────

function LeaveRow({
  leave,
  approving,
  rejecting,
  onApprove,
  onReject,
}: {
  leave: PendingLeaveDto;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: (notes?: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{leave.employeeName}</Text>
      <Text style={styles.rowSubtitle}>
        {titleCase(leave.leaveType)} · {leave.startDate} → {leave.endDate} ({leave.totalDays}d)
      </Text>
      {leave.reason ? <Text style={styles.rowNotes}>{leave.reason}</Text> : null}

      {rejectOpen ? (
        <View style={styles.rejectForm}>
          <TextInput
            style={styles.input}
            placeholder="Reason (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            autoFocus
          />
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.rejectConfirm}
              disabled={rejecting}
              onPress={() => {
                onReject(notes.trim() || undefined);
                setRejectOpen(false);
              }}
            >
              <Text style={styles.rejectConfirmText}>{rejecting ? "..." : "Confirm reject"}</Text>
            </Pressable>
            <Pressable onPress={() => setRejectOpen(false)}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable style={styles.approveButton} disabled={approving} onPress={onApprove}>
            <Text style={styles.approveButtonText}>{approving ? "..." : "Approve"}</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setRejectOpen(true)}>
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PurchaseRow({
  item,
  approving,
  rejecting,
  onApprove,
  onReject,
}: {
  item: PendingPurchaseApprovalDto;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.value}>{formatCompactValue(item.totalAmount, item.currency)}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {item.requestNumber} · {item.requestedBy} · {item.department}
      </Text>
      <Text style={styles.rowNotes} numberOfLines={2}>
        {item.justification}
      </Text>

      {rejectOpen ? (
        <View style={styles.rejectForm}>
          <TextInput
            style={styles.input}
            placeholder="Reason (required)"
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
          />
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.rejectConfirm, !reason.trim() && styles.buttonDisabled]}
              disabled={rejecting || !reason.trim()}
              onPress={() => {
                onReject(reason.trim());
                setRejectOpen(false);
              }}
            >
              <Text style={styles.rejectConfirmText}>{rejecting ? "..." : "Confirm reject"}</Text>
            </Pressable>
            <Pressable onPress={() => setRejectOpen(false)}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable style={styles.approveButton} disabled={approving} onPress={onApprove}>
            <Text style={styles.approveButtonText}>{approving ? "..." : "Approve"}</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setRejectOpen(true)}>
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SalesReturnRow({
  item,
  approving,
  rejecting,
  onApprove,
  onReject,
}: {
  item: PendingSalesReturnDto;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [confirmingReject, setConfirmingReject] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.customerName}
        </Text>
        <Text style={styles.value}>{formatCompactValue(item.refundAmount, item.currency)}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {item.returnNumber} · Order {item.orderNumber}
      </Text>
      <Text style={styles.rowNotes}>{titleCase(item.reason)}{item.reasonDetail ? ` — ${item.reasonDetail}` : ""}</Text>

      {confirmingReject ? (
        <View style={styles.actionsRow}>
          <Text style={styles.rowSubtitle}>Reject this return?</Text>
          <Pressable
            style={styles.rejectConfirm}
            disabled={rejecting}
            onPress={() => {
              onReject();
              setConfirmingReject(false);
            }}
          >
            <Text style={styles.rejectConfirmText}>{rejecting ? "..." : "Yes, reject"}</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmingReject(false)}>
            <Text style={styles.cancelLink}>No</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable style={styles.approveButton} disabled={approving} onPress={onApprove}>
            <Text style={styles.approveButtonText}>{approving ? "..." : "Approve"}</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setConfirmingReject(true)}>
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PayrollRow({
  run,
  action,
  currency,
  busy,
  rejecting,
  onAct,
  onReject,
}: {
  run: PendingPayrollRunDto;
  action: PayrollActionKind;
  currency: string;
  busy: boolean;
  rejecting: boolean;
  onAct: () => void;
  onReject?: (reason?: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{run.period}</Text>
        <Text style={styles.value}>{formatCompactValue(run.totalNetSalary, currency)}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {run.runNumber} · {run.slipCount} employee{run.slipCount === 1 ? "" : "s"} · {titleCase(run.status)}
      </Text>
      {run.createdByName ? <Text style={styles.rowNotes}>Created by {run.createdByName}</Text> : null}

      {rejectOpen ? (
        <View style={styles.rejectForm}>
          <TextInput
            style={styles.input}
            placeholder="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
          />
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.rejectConfirm}
              disabled={rejecting}
              onPress={() => {
                onReject?.(reason.trim() || undefined);
                setRejectOpen(false);
              }}
            >
              <Text style={styles.rejectConfirmText}>{rejecting ? "..." : "Confirm reject"}</Text>
            </Pressable>
            <Pressable onPress={() => setRejectOpen(false)}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable style={styles.approveButton} disabled={busy} onPress={onAct}>
            <Text style={styles.approveButtonText}>{busy ? "..." : PAYROLL_ACTION_LABEL[action]}</Text>
          </Pressable>
          {onReject ? (
            <Pressable style={styles.rejectButton} onPress={() => setRejectOpen(true)}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View>
      <Text style={styles.errorText}>Couldn&apos;t load this.</Text>
      <Pressable onPress={onRetry}>
        <Text style={styles.retry}>Tap to retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptyText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  allClear: { fontSize: 14, color: "#16a34a", fontWeight: "600", textAlign: "center", paddingVertical: 8 },

  errorText: { color: "#dc2626", fontSize: 13 },
  retry: { color: "#2563eb", fontWeight: "600", fontSize: 13, marginTop: 4 },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  countBadge: { backgroundColor: "#111827", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptySection: { fontSize: 13, color: "#6b7280" },

  row: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10, marginTop: 2, gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#111827", flexShrink: 1 },
  rowSubtitle: { fontSize: 12, color: "#6b7280" },
  rowNotes: { fontSize: 12, color: "#4b5563", fontStyle: "italic" },
  value: { fontSize: 13, fontWeight: "700", color: "#111827" },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  approveButton: { backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  approveButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rejectButton: { paddingHorizontal: 12, paddingVertical: 8 },
  rejectButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 13 },

  rejectForm: { gap: 8, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 44,
    backgroundColor: "#fff",
    textAlignVertical: "top",
    fontSize: 13,
  },
  buttonDisabled: { backgroundColor: "#fca5a5" },
  rejectConfirm: { backgroundColor: "#dc2626", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  rejectConfirmText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelLink: { color: "#6b7280", fontSize: 13 },
});
