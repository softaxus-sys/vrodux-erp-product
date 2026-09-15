import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppointmentsList } from "@/hooks/use-healthcare";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { AppointmentDto } from "@/types/healthcare";

export default function AppointmentsListScreen() {
  const list = useAppointmentsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((a) => a.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(a) => a.id}
      renderItem={(a) => <AppointmentRow appointment={a} />}
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
      searchPlaceholder="Search by patient or doctor…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="calendar"
      emptyTitle="No appointments here"
    />
  );
}

function AppointmentRow({ appointment }: { appointment: AppointmentDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {appointment.patientName}
        </Text>
        <Badge label={titleCaseStatus(appointment.status)} tone={guessStatusTone(appointment.status)} />
      </View>
      <Text style={styles.meta}>
        {appointment.appointmentNumber} · Dr. {appointment.doctor}
        {appointment.department ? ` · ${appointment.department}` : ""}
      </Text>
      <Text style={styles.stat}>{appointment.scheduledAt}</Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
