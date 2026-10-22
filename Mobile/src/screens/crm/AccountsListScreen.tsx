import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useAccountsSearch } from "@/hooks/use-crm-write";
import { CRM_CUSTOMERS_CREATE, CRM_CUSTOMERS_EDIT } from "@/lib/crm-write.api";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "AccountsList">;

export default function AccountsListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const query = useAccountsSearch(search);
  const canCreate = hasPermission(...CRM_CUSTOMERS_CREATE);
  const canEdit = hasPermission(...CRM_CUSTOMERS_EDIT);

  useHeaderActions(navigation, [{ label: "New", enabled: canCreate, onPress: () => navigation.navigate("AccountForm", {}) }]);

  return (
    <View style={styles.container}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search accounts…" />
      {query.isError ? (
        <ErrorState message="Could not load accounts." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
        ListEmptyComponent={<EmptyListState title="No accounts" subtitle={search ? "Try another search." : "Create the first account."} />}
        renderItem={({ item }) => (
          <ListItemCard onPress={canEdit ? () => navigation.navigate("AccountForm", { accountId: item.id }) : undefined}>
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {item.tier ? <Badge label={item.tier} tone="primary" /> : null}
            </View>
            <Text style={styles.sub} numberOfLines={1}>
              {[item.industry, item.city].filter(Boolean).join(" · ") || item.email || ""}
            </Text>
            {item.accountManager ? <Text style={styles.sub}>Manager: {item.accountManager}</Text> : null}
          </ListItemCard>
        )}
      />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg, gap: spacing.md },
    list: { paddingBottom: spacing.xxxl },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
  });
}
