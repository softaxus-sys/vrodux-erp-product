import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLgThreadsPaged } from "@/hooks/use-leadgen";
import { lgLabel, lgTone } from "@/lib/leadgen.api";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgInbox">;
const FILTERS = [
  { key: "replies", label: "Replies" },
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
  { key: "archived", label: "Archived" },
] as const;

export default function LgInboxScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("replies");
  const [search, setSearch] = useState("");
  const list = useLgThreadsPaged({
    repliesOnly: filter === "replies" ? true : undefined,
    unread: filter === "unread" ? true : undefined,
    archived: filter === "archived" ? true : undefined,
    search: search.trim() || undefined,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search replies…" />
      <View style={styles.chips}>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </View>
      {list.isError ? (
        <ErrorState message="Could not load the inbox." onRetry={list.refresh} />
      ) : list.isLoading && list.items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={list.items.length === 0 ? undefined : { paddingVertical: spacing.md }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListEmptyComponent={<EmptyListState title="Nothing here" subtitle="Replies from prospects appear here." />}
          renderItem={({ item: t }) => (
            <ListItemCard onPress={() => navigation.navigate("LgThread", { id: t.id, subject: t.subject })}>
              <View style={styles.row}>
                <Text style={[styles.name, t.unreadCount > 0 && styles.unread]} numberOfLines={1}>{t.prospectName ?? t.counterparty}</Text>
                {t.unreadCount > 0 ? <Badge label={`${t.unreadCount} new`} tone="primary" dot={false} /> : null}
              </View>
              <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
              {t.snippet ? <Text style={styles.sub} numberOfLines={2}>{t.snippet}</Text> : null}
              <View style={styles.row}>
                {t.classification !== "none" ? <Badge label={lgLabel(t.classification)} tone={lgTone(t.classification)} /> : <View />}
                <Text style={styles.sub}>{new Date(t.lastMessageAt).toLocaleDateString()}</Text>
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
    chips: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    unread: { fontWeight: fontWeight.bold },
    subject: { fontSize: fontSize.base, color: colors.foreground },
    sub: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
