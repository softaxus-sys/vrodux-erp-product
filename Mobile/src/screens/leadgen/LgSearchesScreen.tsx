import { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useLgCancelSearch, useLgSearches } from "@/hooks/use-leadgen";
import { LG_SEARCHES_CREATE, LG_PROSPECTS_VIEW, isSearchActive, lgLabel, lgTone } from "@/lib/leadgen.api";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { Badge, Button, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgSearches">;

export default function LgSearchesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgSearches();
  const cancel = useLgCancelSearch();
  const canCreate = hasPermission(...LG_SEARCHES_CREATE);
  const canOpen = hasPermission(...LG_PROSPECTS_VIEW);

  useHeaderActions(navigation, [{ label: "New", enabled: canCreate, onPress: () => navigation.navigate("LgNewSearch") }]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message="Could not load searches." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingVertical: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={<EmptyListState title="No searches yet" subtitle={canCreate ? "Tap New to find businesses." : undefined} />}
      renderItem={({ item: s }) => (
        <ListItemCard onPress={canOpen ? () => navigation.navigate("LgProspects", { searchId: s.id, searchName: s.name }) : undefined}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            <Badge label={lgLabel(s.status)} tone={lgTone(s.status)} />
          </View>
          <Text style={styles.sub}>
            {s.foundCount} found · {s.newCount} new · {s.duplicateCount} already known · {s.revealedCount} revealed
          </Text>
          {s.progress && isSearchActive(s) ? <Text style={styles.sub}>{s.progress}</Text> : null}
          {s.error ? <Text style={styles.error}>{s.error}</Text> : null}
          {isSearchActive(s) && canCreate ? (
            <Button label="Cancel search" size="sm" variant="outline" onPress={() => cancel.mutate(s.id)} disabled={cancel.isPending} />
          ) : null}
        </ListItemCard>
      )}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    error: { fontSize: fontSize.base, color: colors.destructive },
  });
}
