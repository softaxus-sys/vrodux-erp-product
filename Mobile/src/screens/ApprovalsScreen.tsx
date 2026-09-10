import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { Button, Card, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
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
        <View style={styles.emptyIcon}>
          <Feather name="check-square" size={22} color={colors.subtleForeground} />
        </View>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
    >
      {!stillLoading && totalPending === 0 ? (
        <View style={styles.allClearBanner}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={styles.allClearText}>You&apos;re all caught up. Nothing is waiting on you.</Text>
        </View>
      ) : null}

      {canLeaves ? (
        <SectionCard title="Leave requests" right={<CountBadge count={leaves.data?.items.length} />}>
          {leaves.isLoading ? (
            <LoadingState size="small" />
          ) : leaves.isError ? (
            <ErrorState message="Couldn't load this." onRetry={() => leaves.refetch()} />
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
        </SectionCard>
      ) : null}

      {canPurchase ? (
        <SectionCard title="Purchase requisitions" right={<CountBadge count={purchase.data?.length} />}>
          {purchase.isLoading ? (
            <LoadingState size="small" />
          ) : purchase.isError ? (
            <ErrorState message="Couldn't load this." onRetry={() => purchase.refetch()} />
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
        </SectionCard>
      ) : null}

      {canSalesReturns ? (
        <SectionCard title="Sales returns" right={<CountBadge count={salesReturns.data?.length} />}>
          {salesReturns.isLoading ? (
            <LoadingState size="small" />
          ) : salesReturns.isError ? (
            <ErrorState message="Couldn't load this." onRetry={() => salesReturns.refetch()} />
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
        </SectionCard>
      ) : null}

      {canPayroll ? (
        <SectionCard title="Payroll runs" right={<CountBadge count={payrollActions.length} />}>
          {payroll.isLoading ? (
            <LoadingState size="small" />
          ) : payroll.isError ? (
            <ErrorState message="Couldn't load this." onRetry={() => payroll.refetch()} />
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
        </SectionCard>
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
    <Card variant="flat" padding="md" style={styles.row}>
      <Text style={styles.rowTitle}>{leave.employeeName}</Text>
      <Text style={styles.rowSubtitle}>
        {titleCase(leave.leaveType)} · {leave.startDate} → {leave.endDate} ({leave.totalDays}d)
      </Text>
      {leave.reason ? <Text style={styles.rowNotes}>{leave.reason}</Text> : null}

      {rejectOpen ? (
        <RejectForm
          value={notes}
          onChangeText={setNotes}
          placeholder="Reason (optional)"
          rejecting={rejecting}
          onConfirm={() => {
            onReject(notes.trim() || undefined);
            setRejectOpen(false);
          }}
          onCancel={() => setRejectOpen(false)}
        />
      ) : (
        <ApproveRejectRow approving={approving} onApprove={onApprove} onReject={() => setRejectOpen(true)} />
      )}
    </Card>
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
    <Card variant="flat" padding="md" style={styles.row}>
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
        <RejectForm
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (required)"
          rejecting={rejecting}
          confirmDisabled={!reason.trim()}
          onConfirm={() => {
            onReject(reason.trim());
            setRejectOpen(false);
          }}
          onCancel={() => setRejectOpen(false)}
        />
      ) : (
        <ApproveRejectRow approving={approving} onApprove={onApprove} onReject={() => setRejectOpen(true)} />
      )}
    </Card>
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
    <Card variant="flat" padding="md" style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.customerName}
        </Text>
        <Text style={styles.value}>{formatCompactValue(item.refundAmount, item.currency)}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {item.returnNumber} · Order {item.orderNumber}
      </Text>
      <Text style={styles.rowNotes}>
        {titleCase(item.reason)}
        {item.reasonDetail ? ` — ${item.reasonDetail}` : ""}
      </Text>

      {confirmingReject ? (
        <View style={styles.actionsRow}>
          <Text style={styles.rowSubtitle}>Reject this return?</Text>
          <Button
            label={rejecting ? "..." : "Yes, reject"}
            size="sm"
            variant="destructive"
            disabled={rejecting}
            onPress={() => {
              onReject();
              setConfirmingReject(false);
            }}
          />
          <Button label="No" size="sm" variant="ghost" onPress={() => setConfirmingReject(false)} />
        </View>
      ) : (
        <ApproveRejectRow approving={approving} onApprove={onApprove} onReject={() => setConfirmingReject(true)} />
      )}
    </Card>
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
    <Card variant="flat" padding="md" style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{run.period}</Text>
        <Text style={styles.value}>{formatCompactValue(run.totalNetSalary, currency)}</Text>
      </View>
      <Text style={styles.rowSubtitle}>
        {run.runNumber} · {run.slipCount} employee{run.slipCount === 1 ? "" : "s"} · {titleCase(run.status)}
      </Text>
      {run.createdByName ? <Text style={styles.rowNotes}>Created by {run.createdByName}</Text> : null}

      {rejectOpen ? (
        <RejectForm
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (optional)"
          rejecting={rejecting}
          onConfirm={() => {
            onReject?.(reason.trim() || undefined);
            setRejectOpen(false);
          }}
          onCancel={() => setRejectOpen(false)}
        />
      ) : (
        <View style={styles.actionsRow}>
          <Button label={busy ? "..." : PAYROLL_ACTION_LABEL[action]} size="sm" disabled={busy} onPress={onAct} />
          {onReject ? <Button label="Reject" size="sm" variant="ghost" onPress={() => setRejectOpen(true)} /> : null}
        </View>
      )}
    </Card>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────────────────────

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{count}</Text>
    </View>
  );
}

function ApproveRejectRow({ approving, onApprove, onReject }: { approving: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <View style={styles.actionsRow}>
      <Button label={approving ? "..." : "Approve"} size="sm" disabled={approving} onPress={onApprove} />
      <Button label="Reject" size="sm" variant="ghost" onPress={onReject} />
    </View>
  );
}

function RejectForm({
  value,
  onChangeText,
  placeholder,
  rejecting,
  confirmDisabled,
  onConfirm,
  onCancel,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  rejecting: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.rejectForm}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.subtleForeground}
        value={value}
        onChangeText={onChangeText}
        multiline
        autoFocus
      />
      <View style={styles.actionsRow}>
        <Button
          label={rejecting ? "..." : "Confirm reject"}
          size="sm"
          variant="destructive"
          disabled={rejecting || confirmDisabled}
          onPress={onConfirm}
        />
        <Button label="Cancel" size="sm" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
  emptyText: { fontSize: fontSize.md, color: colors.mutedForeground, textAlign: "center" },

  allClearBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  allClearText: { fontSize: fontSize.base, color: colors.success, fontWeight: fontWeight.semibold },

  emptySection: { fontSize: fontSize.base, color: colors.mutedForeground },

  countBadge: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  countBadgeText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  row: { gap: spacing.xs, marginBottom: spacing.sm },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
  rowSubtitle: { fontSize: fontSize.sm, color: colors.mutedForeground },
  rowNotes: { fontSize: fontSize.sm, color: colors.foregroundSecondary, fontStyle: "italic" },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.foreground },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap" },

  rejectForm: { gap: spacing.sm, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    minHeight: 44,
    backgroundColor: colors.card,
    textAlignVertical: "top",
    fontSize: fontSize.base,
    color: colors.foreground,
  },
});
