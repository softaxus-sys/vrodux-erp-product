import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSites } from "@/hooks/use-construction";
import { guessStatusTone, titleCaseStatus } from "@/lib/verticals-shared";
import type { SiteDto } from "@/types/construction";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function SitesListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const sites = useSites();

  const statusFilters = useMemo(() => {
    const present = new Set((sites.data ?? []).map((s) => s.status));
    return [{ key: "all", label: "All" }, ...Array.from(present).map((s) => ({ key: s, label: titleCaseStatus(s) }))];
  }, [sites.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sites.data ?? []).filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.projectName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sites.data, search, status]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by site or project…" />
      <View style={styles.filterRow}>
        {statusFilters.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>

      {sites.isError ? (
        <ErrorState message="Couldn't load sites." onRetry={() => sites.refetch()} />
      ) : sites.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={sites.isRefetching} onRefresh={() => sites.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="map-pin" title="No sites here" />}
          renderItem={({ item }) => <SiteRow site={item} />}
        />
      )}
    </View>
  );
}

function SiteRow({ site }: { site: SiteDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {site.name}
        </Text>
        <Badge label={titleCaseStatus(site.status)} tone={guessStatusTone(site.status)} />
      </View>
      <Text style={styles.meta}>
        {site.siteCode} · {site.projectName} · {site.location.city}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>
          {site.workers.current}/{site.workers.max} workers
        </Text>
        <Text style={styles.stat}>Safety score {site.safetyScore}</Text>
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
  });
}
