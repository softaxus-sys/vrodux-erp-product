import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEmployees, useHrSummary } from "@/hooks/use-hr-directory";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_TONE, type EmployeeDto, type EmployeeStatus } from "@/types/hr-directory";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { HrStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HrStackParamList, "EmployeesList">;

type StatusFilter = "active" | "all" | EmployeeStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "on_leave", label: "On leave" },
  { key: "probation", label: "Probation" },
  { key: "all", label: "All" },
];

export default function EmployeesListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [department, setDepartment] = useState<string | null>(null);

  // /employees/all is a single flat fetch (mirrors the web app -- there is no paginated list
  // endpoint wired up on either client), so filtering happens entirely client-side below.
  const query = useEmployees();
  const summary = useHrSummary();

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of query.data ?? []) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [query.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (department && e.department !== department) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
      );
    });
  }, [query.data, search, status, department]);

  return (
    <View style={styles.container}>
      {summary.data ? (
        <View style={styles.summaryRow}>
          <SummaryStat label="Total" value={summary.data.total} />
          <SummaryStat label="Active" value={summary.data.active} />
          <SummaryStat label="On leave" value={summary.data.onLeave} />
          <SummaryStat label="Probation" value={summary.data.probation} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name, ID, email, department…" />

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>
      {departments.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.deptRow}
          contentContainerStyle={styles.deptRowContent}
          data={["__all__", ...departments]}
          keyExtractor={(d) => d}
          renderItem={({ item }) => (
            <Chip
              label={item === "__all__" ? "All depts" : item}
              active={item === "__all__" ? department === null : department === item}
              onPress={() => setDepartment(item === "__all__" ? null : item)}
            />
          )}
        />
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load employees." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          ListEmptyComponent={<EmptyListState icon="users" title="No employees match" />}
          renderItem={({ item }) => (
            <EmployeeRow employee={item} onPress={() => navigation.navigate("EmployeeDetail", { employeeId: item.id, employeeName: item.fullName })} />
          )}
        />
      )}
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function EmployeeRow({ employee, onPress }: { employee: EmployeeDto; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard onPress={onPress}>
      <View style={styles.rowTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(employee.fullName)}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>{employee.fullName || "—"}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[employee.designation, employee.department].filter(Boolean).join(" · ") || employee.employeeId}
          </Text>
        </View>
        <Badge label={EMPLOYEE_STATUS_LABELS[employee.status]} tone={EMPLOYEE_STATUS_TONE[employee.status]} />
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    summaryRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
    summaryStat: { flex: 1 },
    summaryValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    summaryLabel: { fontSize: fontSize.xs, color: colors.mutedForeground },

    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xs },
    deptRow: { maxHeight: 40 },
    deptRowContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },

    list: { paddingVertical: spacing.md },
    rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.onPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
    rowInfo: { flex: 1 },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
  });
}
