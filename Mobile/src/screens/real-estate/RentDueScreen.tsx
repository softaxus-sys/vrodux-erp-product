import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRecordPayment, useRemindContract, useRentDue } from "@/hooks/use-real-estate";
import { RecordPaymentModal, type RecordPaymentInput } from "@/components/real-estate/RecordPaymentModal";
import { formatCompactValue } from "@/lib/crm-helpers";
import { REAL_ESTATE_RENT_RECORD, REAL_ESTATE_RENT_REMIND } from "@/lib/real-estate.api";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import type { RentDueItemDto } from "@/types/real-estate";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type Tone, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "RentDue">;

const WINDOWS = [7, 14, 30, 60];

function urgencyTone(item: RentDueItemDto): Tone {
  if (item.daysOverdue > 0) return "destructive";
  if (item.daysUntilDue <= 7) return "warning";
  return "info";
}

function urgencyLabel(item: RentDueItemDto): string {
  if (item.daysOverdue > 0) return `${item.daysOverdue}d overdue`;
  if (item.daysUntilDue === 0) return "Due today";
  return `Due in ${item.daysUntilDue}d`;
}

/** The chase queue -- everything overdue plus what falls due inside the window, overdue-first
 *  (the same order the backend already returns it in). Record Payment / Remind are available
 *  right here so an operator working this list doesn't need to open each contract in turn. */
export default function RentDueScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canRecord = hasPermission(REAL_ESTATE_RENT_RECORD);
  const canRemind = hasPermission(REAL_ESTATE_RENT_REMIND);
  const [withinDays, setWithinDays] = useState(30);
  const [paying, setPaying] = useState<RentDueItemDto | null>(null);

  const rentDue = useRentDue(withinDays);
  const recordPayment = useRecordPayment();
  const remind = useRemindContract();

  const total = (rentDue.data ?? []).reduce((sum, i) => sum + i.balance, 0);

  return (
    <View style={styles.container}>
      {rentDue.data ? (
        <View style={styles.summaryRow}>
          <SummaryTile label="Items" value={String(rentDue.data.length)} />
          <SummaryTile label="Total Due" value={formatCompactValue(total, currency)} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {WINDOWS.map((w) => (
          <Chip key={w} label={`${w}d`} active={withinDays === w} onPress={() => setWithinDays(w)} />
        ))}
      </View>

      {rentDue.isError ? (
        <ErrorState message="Couldn't load the rent-due queue." onRetry={() => rentDue.refetch()} />
      ) : rentDue.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rentDue.data ?? []}
          keyExtractor={(i) => i.installmentId}
          contentContainerStyle={(rentDue.data ?? []).length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={rentDue.isRefetching} onRefresh={() => rentDue.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="check-circle" title="Nothing due in this window" />}
          renderItem={({ item }) => (
            <RentDueRow
              item={item}
              currency={currency}
              canRecord={canRecord}
              canRemind={canRemind}
              busy={recordPayment.isPending || remind.isPending}
              onOpen={() => navigation.navigate("ContractDetail", { contractId: item.contractId, contractNumber: item.contractNumber })}
              onRecord={() => setPaying(item)}
              onRemind={() => remind.mutate({ contractId: item.contractId, installmentId: item.installmentId })}
            />
          )}
        />
      )}

      <RecordPaymentModal
        visible={Boolean(paying)}
        balance={paying?.balance ?? 0}
        currency={currency}
        busy={recordPayment.isPending}
        onCancel={() => setPaying(null)}
        onConfirm={(input: RecordPaymentInput) => {
          if (!paying) return;
          recordPayment.mutate({
            contractId: paying.contractId,
            installmentId: paying.installmentId,
            body: { amount: input.amount, paidDate: input.paidDate, method: input.method, reference: input.reference },
          });
          setPaying(null);
        }}
      />
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function RentDueRow({
  item,
  currency,
  canRecord,
  canRemind,
  busy,
  onOpen,
  onRecord,
  onRemind,
}: {
  item: RentDueItemDto;
  currency: string;
  canRecord: boolean;
  canRemind: boolean;
  busy: boolean;
  onOpen: () => void;
  onRecord: () => void;
  onRemind: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onOpen}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {item.tenantName}
        </Text>
        <Badge label={urgencyLabel(item)} tone={urgencyTone(item)} />
      </View>
      <Text style={styles.meta}>
        {item.propertyName} · {item.unitNumber} · {item.contractNumber}
      </Text>
      <Text style={styles.amount}>{formatCompactValue(item.balance, currency)} due {item.dueDate}</Text>

      {canRecord || canRemind ? (
        <View style={styles.actionsRow}>
          {canRecord ? <Button label="Record Payment" size="sm" disabled={busy} onPress={onRecord} /> : null}
          {canRemind ? <Button label="Remind" size="sm" variant="outline" disabled={busy} onPress={onRemind} /> : null}
        </View>
      ) : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    summaryRow: { flexDirection: "row", justifyContent: "space-around", margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: spacing.md },
    summaryTile: { alignItems: "center" },
    summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    amount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground, marginTop: 2 },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  });
}
