import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useActivitiesPage, useActivitiesSummary } from "@/hooks/use-crm-extra";
import { ActivityRow } from "@/components/crm/ActivityParts";
import { Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "Activities">;
type Tab = "overdue" | "today" | "upcoming" | "done";

const iso = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().split("T")[0];

/** Everything scheduled across leads, opportunities and accounts. The server scopes it to what you may see. */
export default function ActivitiesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");
  const summary = useActivitiesSummary();

  const params = useMemo(() => {
    const base = { page: 1, pageSize: 60, search: search.trim() || undefined };
    if (tab === "overdue") return { ...base, completed: false, dueBefore: iso(0) };
    if (tab === "today") return { ...base, completed: false, dueOn: iso(0) };
    if (tab === "done") return { ...base, completed: true };
    return { ...base, completed: false };
  }, [tab, search]);
  const q = useActivitiesPage(params);

  // "Upcoming" has no server filter of its own: open items due after today.
  const items = useMemo(() => {
    const list = q.data?.items ?? [];
    return tab === "upcoming" ? list.filter((a) => a.dueDate && a.dueDate > iso(0)) : list;
  }, [q.data, tab]);

  const s = summary.data;
  const count = (n?: number) => (n ? ` (${n})` : "");

  function open(a: (typeof items)[number]) {
    if (a.relatedToType === "lead") navigation.getParent()?.navigate("Leads", { screen: "LeadDetail", params: { leadId: a.relatedToId, leadName: a.relatedToName ?? "Lead" } } as never);
    else if (a.relatedToType === "customer") navigation.navigate("AccountDetail", { accountId: a.relatedToId, accountName: a.relatedToName ?? "Account" });
    else navigation.getParent()?.navigate("Pipeline", { screen: "DealDetail", params: { dealId: a.relatedToId, dealTitle: a.relatedToName ?? "Opportunity" } } as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search activities…" />
      <View style={styles.chips}>
        <Chip label={`Overdue${count(s?.overdue)}`} active={tab === "overdue"} onPress={() => setTab("overdue")} />
        <Chip label={`Today${count(s?.dueToday)}`} active={tab === "today"} onPress={() => setTab("today")} />
        <Chip label={`Upcoming${count(s?.upcoming)}`} active={tab === "upcoming"} onPress={() => setTab("upcoming")} />
        <Chip label="Done" active={tab === "done"} onPress={() => setTab("done")} />
      </View>
      {q.isError ? (
        <ErrorState message="Could not load activities." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={items.length === 0 ? undefined : { paddingVertical: spacing.md }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState title="Nothing here" subtitle={tab === "overdue" ? "You are all caught up." : undefined} />}
          renderItem={({ item }) => (
            <ListItemCard onPress={() => open(item)}>
              {item.relatedToName ? <Text style={styles.about}>{item.relatedToName}</Text> : null}
              <ActivityRow a={item} />
            </ListItemCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    about: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  });
}
