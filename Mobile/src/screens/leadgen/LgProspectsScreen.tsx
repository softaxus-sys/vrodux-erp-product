import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLgProspectsPaged } from "@/hooks/use-leadgen";
import { PROSPECT_STATUSES, lgLabel, lgTone, scoreTone } from "@/lib/leadgen.api";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgProspects">;

export default function LgProspectsScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const searchId = route.params?.searchId;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const list = useLgProspectsPaged({ search: search.trim() || undefined, status: status === "all" ? undefined : status, searchId, sort: "quality" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search businesses…" />
      {route.params?.searchName ? <Text style={styles.scope}>From search: {route.params.searchName}</Text> : null}
      <View style={styles.chips}>
        {["all", ...PROSPECT_STATUSES].map((s) => (
          <Chip key={s} label={s === "all" ? "All" : lgLabel(s)} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>
      {list.isError ? (
        <ErrorState message="Could not load prospects." onRetry={list.refresh} />
      ) : list.isLoading && list.items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={list.items.length === 0 ? undefined : { paddingVertical: spacing.md }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListEmptyComponent={<EmptyListState title="No prospects" subtitle="Run a search to find businesses." />}
          renderItem={({ item: p }) => (
            <ListItemCard onPress={() => navigation.navigate("LgProspect", { id: p.id, name: p.name })}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                <Badge label={lgLabel(p.status)} tone={lgTone(p.status)} />
              </View>
              <Text style={styles.sub} numberOfLines={1}>
                {[p.categoryLabel, p.area ?? p.city, p.rating ? `★ ${p.rating}` : null].filter(Boolean).join(" · ")}
              </Text>
              <View style={styles.row}>
                <Badge label={`Quality ${p.qualityScore}`} tone={scoreTone(p.qualityScore)} dot={false} />
                <Text style={styles.sub}>{p.isRevealed ? "Contact revealed" : "Contact locked"}</Text>
                {p.crmLeadId ? <Text style={styles.sub}>· In CRM</Text> : null}
              </View>
            </ListItemCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    scope: { paddingHorizontal: spacing.lg, color: colors.mutedForeground, fontSize: fontSize.sm, marginBottom: spacing.xs },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "space-between" },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
  });
}
