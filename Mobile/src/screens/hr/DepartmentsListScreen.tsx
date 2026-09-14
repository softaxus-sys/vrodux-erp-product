import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useDepartments } from "@/hooks/use-hr-directory";
import type { DepartmentDto } from "@/types/hr-directory";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/** Read-only on mobile for this pass -- the backend supports full CRUD (no dedicated
 *  `hr.departments.*` key; writes reuse `hr.employees.create/edit/delete`), but the web app
 *  itself only wires up list + create, and a mobile create form isn't worth building before that
 *  gets more use. Shows the backend's full DepartmentDto (employeeCount included), richer than
 *  the web app's own stripped-down dropdown DTO. */
export default function DepartmentsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");

  const query = useDepartments();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return query.data ?? [];
    return (query.data ?? []).filter(
      (d) => d.name.toLowerCase().includes(q) || (d.code ?? "").toLowerCase().includes(q),
    );
  }, [query.data, search]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search departments…" />

      {query.isError ? (
        <ErrorState message="Couldn't load departments." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="briefcase" title="No departments match" />}
          renderItem={({ item }) => <DepartmentRow department={item} />}
        />
      )}
    </View>
  );
}

function DepartmentRow({ department }: { department: DepartmentDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{department.name}</Text>
        {!department.isActive ? <Badge label="Inactive" tone="neutral" /> : null}
      </View>
      <Text style={styles.meta}>
        {[department.code, `${department.employeeCount} ${department.employeeCount === 1 ? "employee" : "employees"}`]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {department.description ? <Text style={styles.description} numberOfLines={2}>{department.description}</Text> : null}
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
    description: { fontSize: fontSize.sm, color: colors.foregroundSecondary, marginTop: spacing.xs },
  });
}
