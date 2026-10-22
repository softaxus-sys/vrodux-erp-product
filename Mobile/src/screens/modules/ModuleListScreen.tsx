import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { LIST_BY_KEY, type Rec } from "@/lib/module-browser";
import { titleCaseStatus } from "@/lib/verticals-shared";
import { NextStepBar, useVerticalNew } from "@/components/verticals/VerticalActions";
import { Badge, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ExtraStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ExtraStackParamList, "ModuleList">;

export default function ModuleListScreen({ route, navigation }: Props) {
  const { list } = LIST_BY_KEY[route.params.listKey];
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => navigation.setOptions({ headerTitle: list.title }), [navigation, list.title]);
  // Only lists that have a create form show "New" (hook must run unconditionally, so it takes a safe key).
  if (list.formKey) useVerticalNewSafe(list.formKey);

  const query = useQuery({
    queryKey: ["module-list", list.key],
    queryFn: async () => {
      const data = await apiClient.get<Rec[] | { items: Rec[] }>(list.path());
      return list.shape === "items" ? (data as { items: Rec[] }).items : (data as Rec[]);
    },
  });

  const statusOf = (r: Rec) => (list.status ? list.status(r) : String(r.status ?? ""));
  const items = query.data ?? [];

  const chips = useMemo(() => {
    const present = Array.from(new Set(items.map(statusOf).filter(Boolean)));
    return present.length > 1 ? ["all", ...present] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => (status === "all" || statusOf(r) === status) && (!q || list.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, status]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={`Couldn't load ${list.title.toLowerCase()}.`} onRetry={() => query.refetch()} />;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search…" />
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((c) => <Chip key={c} label={c === "all" ? "All" : titleCaseStatus(c)} active={status === c} onPress={() => setStatus(c)} />)}
          </View>
        ) : null}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(r, i) => String(r.id ?? i)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
        ListEmptyComponent={<EmptyListState icon={list.icon} title={`No ${list.title.toLowerCase()} here`} />}
        renderItem={({ item }) => {
          const v = list.row(item);
          return (
            <View>
              <ListItemCard onPress={() => navigation.navigate("RecordDetail", { listKey: list.key, record: item })}>
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={2}>{v.title}</Text>
                  {v.badge ? <Badge label={titleCaseStatus(v.badge)} tone={v.tone ?? "neutral"} /> : null}
                </View>
                {v.subtitle ? <Text style={styles.meta} numberOfLines={1}>{v.subtitle}</Text> : null}
                {v.meta ? <Text style={styles.meta} numberOfLines={1}>{v.meta}</Text> : null}
              </ListItemCard>
              {list.stepKey ? <NextStepBar formKey={list.stepKey} id={String(item.id)} status={statusOf(item)} record={item} /> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

/** `useVerticalNew` wrapper: `formKey` is constant for a given screen, so the hook order never changes. */
function useVerticalNewSafe(formKey: string) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useVerticalNew(formKey);
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    top: { padding: spacing.lg, gap: spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    title: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: 2 },
  });
}
