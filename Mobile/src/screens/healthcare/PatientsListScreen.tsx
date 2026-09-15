import { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePatientsList } from "@/hooks/use-healthcare";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { PatientDto } from "@/types/healthcare";

export default function PatientsListScreen() {
  const list = usePatientsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((p) => p.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(p) => p.id}
      renderItem={(p) => <PatientRow patient={p} />}
      isLoading={list.isLoading}
      isError={list.isError}
      isFetching={list.isFetching}
      isRefetching={list.isRefetching}
      hasMore={list.hasMore}
      onRefresh={list.refresh}
      onLoadMore={list.loadMore}
      onRetry={list.refresh}
      search={list.search}
      onSearchChange={list.setSearch}
      searchPlaceholder="Search by name or phone…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="users"
      emptyTitle="No patients here"
    />
  );
}

function PatientRow({ patient }: { patient: PatientDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {patient.fullName}
        </Text>
        <Badge label={titleCaseStatus(patient.status)} tone={guessStatusTone(patient.status)} />
      </View>
      <Text style={styles.meta}>
        {patient.patientNumber} · {patient.gender}
        {patient.assignedDoctor ? ` · Dr. ${patient.assignedDoctor}` : ""}
      </Text>
      <View style={styles.quickActions}>
        <Feather name="phone" size={14} color={colors.primary} />
        <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${patient.phone}`)}>
          {patient.phone}
        </Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    quickActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    phone: { fontSize: fontSize.sm, color: colors.primary },
  });
}
