import { useMemo, useState } from "react";
import { Linking, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useContractors } from "@/hooks/use-construction";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { ContractorDto } from "@/types/construction";
import { EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

export default function ContractorsListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [search, setSearch] = useState("");

  const contractors = useContractors();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contractors.data ?? [];
    return (contractors.data ?? []).filter((c) => c.companyName.toLowerCase().includes(q) || c.trade.toLowerCase().includes(q));
  }, [contractors.data, search]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by company or trade…" />

      {contractors.isError ? (
        <ErrorState message="Couldn't load contractors." onRetry={() => contractors.refetch()} />
      ) : contractors.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={filtered.length === 0 ? undefined : styles.list}
          refreshControl={<RefreshControl refreshing={contractors.isRefetching} onRefresh={() => contractors.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyListState icon="users" title="No contractors here" />}
          renderItem={({ item }) => <ContractorRow contractor={item} currency={currency} />}
        />
      )}
    </View>
  );
}

function ContractorRow({ contractor, currency }: { contractor: ContractorDto; currency: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {contractor.companyName}
        </Text>
        <View style={styles.rating}>
          <Feather name="star" size={13} color={colors.warning} />
          <Text style={styles.ratingText}>{contractor.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {contractor.trade} · {contractor.city}
      </Text>
      <View style={styles.quickActions}>
        <Feather name="phone" size={14} color={colors.primary} />
        <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${contractor.phone}`)}>
          {contractor.phone}
        </Text>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.stat}>{contractor.activeProjects} active projects</Text>
        <Text style={styles.statValue}>{formatCompactValue(contractor.totalContractValue, currency)}</Text>
      </View>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { paddingVertical: spacing.md },

    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    rating: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    meta: { fontSize: fontSize.base, color: colors.foregroundSecondary },
    quickActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    phone: { fontSize: fontSize.sm, color: colors.primary },
    rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    stat: { fontSize: fontSize.sm, color: colors.mutedForeground },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
