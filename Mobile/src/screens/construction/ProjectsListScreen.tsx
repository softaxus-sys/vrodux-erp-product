import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useProjects } from "@/hooks/use-construction";
import { formatCompactValue } from "@/lib/crm-helpers";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import { useAuthStore } from "@/store/auth.store";
import type { ProjectDto } from "@/types/construction";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function ProjectsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const projects = useProjects();

  const statusFilters = useMemo(() => {
    const present = new Set((projects.data ?? []).map((p) => p.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [projects.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects.data ?? []).filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.client.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects.data, search, status]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or client…" />
      <View style={styles.filterRow}>
        {statusFilters.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {projects.isError ? (
        <ErrorState message="Couldn't load projects." onRetry={() => projects.refetch()} />
      ) : projects.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={projects.isRefetching} onRefresh={() => projects.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="briefcase" title="No projects here" />}
          renderItem={({ item }) => <ProjectRow project={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function ProjectRow({ project, currency }: { project: ProjectDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {project.name}
        </Text>
        <Badge label={titleCaseStatus(project.status)} tone={guessStatusTone(project.status)} />
      </View>
      <Text style={styles.meta}>
        {project.projectNumber} · {project.client} · {project.location}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{project.completionPct}% complete</Text>
        <Text style={styles.statValue}>{formatCompactValue(project.contractValue, currency)}</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary, marginBottom: spacing.xs },
    rowBottom: { flexDirection: "row", justifyContent: "space-between" },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
