import { useEffect, useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEmployee } from "@/hooks/use-hr-directory";
import { formatCompactValue } from "@/lib/crm-helpers";
import { CONTRACT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_TONE } from "@/types/hr-directory";
import type { HrStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<HrStackParamList, "EmployeeDetail">;

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function EmployeeDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { employeeId, employeeName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: employeeName });
  }, [navigation, employeeName]);

  const employee = useEmployee(employeeId);

  if (employee.isLoading || !employee.data) {
    return <LoadingState />;
  }
  if (employee.isError) {
    return <ErrorState message="Couldn't load this employee." onRetry={() => employee.refetch()} />;
  }

  const e = employee.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(e.fullName)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{e.fullName || "—"}</Text>
            <Text style={styles.subtitle}>{[e.designation, e.department].filter(Boolean).join(" · ") || "—"}</Text>
          </View>
          <Badge label={EMPLOYEE_STATUS_LABELS[e.status]} tone={EMPLOYEE_STATUS_TONE[e.status]} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Employee ID" value={e.employeeId || "—"} />
          <Stat label="Branch" value={e.branch || "—"} />
          <Stat label="Contract" value={CONTRACT_TYPE_LABELS[e.contractType]} />
          <Stat label="Joined" value={formatDate(e.joinDate)} />
        </View>
      </View>

      <SectionCard title="Contact">
        <View style={styles.actionsRow}>
          <Button label="Call" icon="phone" variant="outline" disabled={!e.mobile && !e.phone} onPress={() => Linking.openURL(`tel:${e.mobile || e.phone}`)} style={styles.actionButton} />
          <Button label="Email" icon="mail" variant="outline" disabled={!e.email} onPress={() => Linking.openURL(`mailto:${e.email}`)} style={styles.actionButton} />
        </View>
        {e.email ? <DetailRow label="Email" value={e.email} /> : null}
        {e.mobile ? <DetailRow label="Mobile" value={e.mobile} /> : null}
        {e.phone && e.phone !== e.mobile ? <DetailRow label="Office phone" value={e.phone} /> : null}
        {e.address ? <DetailRow label="Address" value={e.address} /> : null}
        {e.nationality ? <DetailRow label="Nationality" value={e.nationality} /> : null}
        {e.dateOfBirth ? <DetailRow label="Date of birth" value={formatDate(e.dateOfBirth)} /> : null}
      </SectionCard>

      <SectionCard title="Employment">
        {e.reportingTo ? <DetailRow label="Reports to" value={e.reportingTo} /> : null}
        {e.visaExpiry ? <DetailRow label="Visa expiry" value={formatDate(e.visaExpiry)} /> : null}
        {e.endDate ? <DetailRow label="End date" value={formatDate(e.endDate)} /> : null}
      </SectionCard>

      {e.basicSalary > 0 ? (
        <SectionCard title="Salary & bank">
          <DetailRow label="Basic salary" value={formatCompactValue(e.basicSalary, e.currency)} />
          {e.bankAccount ? <DetailRow label="Bank account" value={e.bankAccount} /> : null}
          {e.iban ? <DetailRow label="IBAN" value={e.iban} /> : null}
          {e.medicalInsurance ? <DetailRow label="Insurance" value={e.medicalInsurance} /> : null}
        </SectionCard>
      ) : null}

      {(e.emiratesId || e.passportNumber || e.labourCardNumber) ? (
        <SectionCard title="Identity & compliance">
          {e.emiratesId ? <DetailRow label="Emirates ID" value={e.emiratesId} /> : null}
          {e.passportNumber ? <DetailRow label="Passport number" value={e.passportNumber} /> : null}
          {e.labourCardNumber ? <DetailRow label="Labour card (MOHRE)" value={e.labourCardNumber} /> : null}
          {e.bankRoutingCode ? <DetailRow label="Bank routing code" value={e.bankRoutingCode} /> : null}
        </SectionCard>
      ) : null}

      {e.skills.length > 0 ? (
        <SectionCard title="Skills">
          <View style={styles.skillRow}>
            {e.skills.map((s) => (
              <Badge key={s} label={s} tone="neutral" dot={false} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {e.emergencyContact?.name ? (
        <SectionCard title="Emergency contact">
          <DetailRow label="Name" value={e.emergencyContact.name} />
          {e.emergencyContact.relation ? <DetailRow label="Relation" value={e.emergencyContact.relation} /> : null}
          {e.emergencyContact.phone ? <DetailRow label="Phone" value={e.emergencyContact.phone} /> : null}
        </SectionCard>
      ) : null}

      {e.linkedAccount ? (
        <SectionCard title="Login account">
          <DetailRow label="Email" value={e.linkedAccount.email} />
          <DetailRow label="Status" value={e.linkedAccount.status} />
          {e.linkedAccount.lastLoginAt ? <DetailRow label="Last login" value={formatDate(e.linkedAccount.lastLoginAt)} /> : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.md },
    headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    headerInfo: { flex: 1 },
    name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground, marginTop: 2 },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl },

    actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
    actionButton: { flex: 1 },

    skillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  });
}
