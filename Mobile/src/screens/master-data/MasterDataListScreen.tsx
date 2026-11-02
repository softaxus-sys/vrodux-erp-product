import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { canWriteMaster, useMasterRecords } from "@/hooks/use-master-data";
import { masterById, matchesMaster } from "@/lib/master-data";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { MasterDataStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<MasterDataStackParamList, "MasterList">;

export default function MasterDataListScreen({ route, navigation }: Props) {
  const { masterId } = route.params;
  const master = masterById(masterId);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const query = useMasterRecords(masterId);
  const canWrite = master ? canWriteMaster(master) && Boolean(master.create) : false;

  useHeaderActions(navigation, [{ label: "New", enabled: canWrite, onPress: () => navigation.navigate("MasterForm", { masterId }) }]);

  const rows = useMemo(
    () => (master ? (query.data ?? []).filter((r) => matchesMaster(master, r, search)) : []),
    [master, query.data, search],
  );

  if (!master) return <ErrorState message="This list is not available." />;

  return (
    <>
      <SearchInput value={search} onChangeText={setSearch} placeholder={`Search ${master.label.toLowerCase()}…`} />
      {query.isError ? (
        <ErrorState message="Could not load this list." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={rows.length === 0 ? undefined : { paddingVertical: spacing.md }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyListState
              title={`No ${master.label.toLowerCase()}`}
              subtitle={search ? "Try another search." : canWrite ? "Tap New to add the first." : undefined}
            />
          }
          renderItem={({ item }) => {
            const v = master.row(item);
            return (
              <ListItemCard onPress={() => navigation.navigate("MasterForm", { masterId, recordId: String(item.id) })}>
                <Text style={styles.title} numberOfLines={1}>{v.title}</Text>
                {v.subtitle ? <Text style={styles.sub} numberOfLines={2}>{v.subtitle}</Text> : null}
                {v.meta ? <Text style={styles.sub} numberOfLines={1}>{v.meta}</Text> : null}
                {v.badge ? <Badge label={v.badge} tone={v.tone ?? "neutral"} /> : null}
              </ListItemCard>
            );
          }}
        />
      )}
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
  });
}
