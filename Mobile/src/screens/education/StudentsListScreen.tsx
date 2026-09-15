import { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStudentsList } from "@/hooks/use-education";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { PagedListView, type StatusFilterOption } from "@/components/verticals/PagedListView";
import { Badge, ListItemCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { StudentDto } from "@/types/education";

export default function StudentsListScreen() {
  const list = useStudentsList();

  const statusFilters: StatusFilterOption[] = useMemo(() => {
    const present = new Set(list.items.map((s) => s.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [list.items]);

  return (
    <PagedListView
      items={list.items}
      keyExtractor={(s) => s.id}
      renderItem={(s) => <StudentRow student={s} />}
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
      searchPlaceholder="Search by name or program…"
      status={list.status}
      onStatusChange={list.setStatus}
      statusFilters={statusFilters}
      emptyIcon="users"
      emptyTitle="No students here"
    />
  );
}

function StudentRow({ student }: { student: StudentDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {student.fullName}
        </Text>
        <Badge label={titleCaseStatus(student.status)} tone={guessStatusTone(student.status)} />
      </View>
      <Text style={styles.meta}>
        {student.studentNumber} · {student.program}
      </Text>
      {student.phone ? (
        <View style={styles.quickActions}>
          <Feather name="phone" size={14} color={colors.primary} />
          <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${student.phone}`)}>
            {student.phone}
          </Text>
        </View>
      ) : null}
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
