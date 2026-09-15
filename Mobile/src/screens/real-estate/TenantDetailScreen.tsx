import { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContractsByTenant } from "@/hooks/use-real-estate";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE, TENANT_STATUS_LABELS, TENANT_STATUS_TONE } from "@/types/real-estate";
import { Badge, Button, DetailRow, EmptyState, ErrorState, ListItemCard, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "TenantDetail">;

export default function TenantDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tenant: t } = route.params;
  navigation.setOptions({ headerTitle: t.name });
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const contracts = useContractsByTenant(t.id);
  const own = contracts.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{t.name}</Text>
        <View style={styles.subtitleRow}>
          <Badge label={TENANT_STATUS_LABELS[t.status] ?? t.status} tone={TENANT_STATUS_TONE[t.status] ?? "neutral"} />
          <Text style={styles.subtitle}>{t.tenantNumber}</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Active Leases" value={String(t.activeContracts)} />
          <Stat label="Total Paid" value={formatCompactValue(t.totalPaid, currency)} tone="primary" />
        </View>
      </View>

      <View style={styles.quickActions}>
        <Button icon="phone" label={t.phone} variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${t.phone}`)} />
        <Button icon="mail" label="Email" variant="outline" size="sm" onPress={() => Linking.openURL(`mailto:${t.email}`)} />
      </View>

      <SectionCard title="Details">
        <DetailRow label="Type" value={t.tenantType} />
        <DetailRow label="Nationality" value={t.nationality} />
        {t.companyName ? <DetailRow label="Company" value={t.companyName} /> : null}
        {t.tradeLicense ? <DetailRow label="Trade License" value={t.tradeLicense} /> : null}
        {t.nationalId ? <DetailRow label="National/Emirates ID" value={t.nationalId} /> : null}
        {t.passportNumber ? <DetailRow label="Passport" value={t.passportNumber} /> : null}
        {t.trn ? <DetailRow label="TRN" value={t.trn} /> : null}
        {t.occupation ? <DetailRow label="Occupation" value={t.occupation} /> : null}
        {t.monthlyIncome != null ? <DetailRow label="Monthly Income" value={formatCompactValue(t.monthlyIncome, currency)} /> : null}
        {t.emergencyContact ? <DetailRow label="Emergency Contact" value={t.emergencyContact} /> : null}
      </SectionCard>

      {t.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{t.notes}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title={`Leases (${own.length})`}>
        {contracts.isLoading ? (
          <LoadingState size="small" />
        ) : contracts.isError ? (
          <ErrorState message="Couldn't load leases." onRetry={() => contracts.refetch()} />
        ) : own.length === 0 ? (
          <EmptyState icon="file-text" title="No leases on file" />
        ) : (
          own.map((c) => (
            <ListItemCard key={c.id} onPress={() => navigation.navigate("ContractDetail", { contractId: c.id, contractNumber: c.contractNumber })}>
              <View style={styles.rowTop}>
                <Text style={styles.contractName}>
                  {c.propertyName} · {c.unitNumber}
                </Text>
                <Badge label={CONTRACT_STATUS_LABELS[c.status] ?? c.status} tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"} />
              </View>
              <Text style={styles.meta}>
                {c.contractNumber} · {c.startDate} → {c.endDate}
              </Text>
              {c.overdueAmount > 0 ? <Text style={styles.overdue}>{formatCompactValue(c.overdueAmount, currency)} overdue</Text> : null}
            </ListItemCard>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    quickActions: { flexDirection: "row", gap: spacing.sm },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    contractName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    overdue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.destructive, marginTop: 2 },
  });
}
