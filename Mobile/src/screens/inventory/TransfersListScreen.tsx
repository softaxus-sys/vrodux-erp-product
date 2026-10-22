import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { useTransferAction, useTransfers } from "@/hooks/use-inventory-write";
import { INVENTORY_TRANSFERS_APPROVE, INVENTORY_TRANSFERS_CREATE } from "@/lib/inventory-write.api";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { Badge, Button, Chip, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "TransfersList">;

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_transit", label: "In transit" },
  { key: "completed", label: "Received" },
];

export default function TransfersListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const me = useAuthStore((s) => s.user?.fullName ?? "");
  const [status, setStatus] = useState("");
  const query = useTransfers(status || undefined);
  const act = useTransferAction();
  const canApprove = hasPermission(...INVENTORY_TRANSFERS_APPROVE);

  useHeaderActions(navigation, [{ label: "New", enabled: hasPermission(...INVENTORY_TRANSFERS_CREATE), onPress: () => navigation.navigate("NewTransfer") }]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
        ))}
      </View>
      {query.isError ? (
        <ErrorState message="Could not load transfers." onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={query.data?.items ?? []}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          ListEmptyComponent={<EmptyListState icon="truck" title="No transfers" />}
          renderItem={({ item }) => (
            <ListItemCard>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.transferNumber}</Text>
                <Badge label={item.status.replace(/_/g, " ")} tone={item.status === "completed" ? "success" : item.status === "in_transit" ? "info" : "warning"} />
              </View>
              <Text style={styles.sub}>{item.fromWarehouseName} → {item.toWarehouseName}</Text>
              <Text style={styles.sub}>{item.items.map((i) => `${i.quantity} × ${i.itemName}`).join(", ")}</Text>
              {canApprove && item.status === "pending" ? (
                <Button label="Approve" size="sm" loading={act.isPending} onPress={() => act.mutate({ id: item.id, action: "approve", by: me })} />
              ) : null}
              {canApprove && item.status === "in_transit" ? (
                <Button label="Mark received" size="sm" loading={act.isPending} onPress={() => act.mutate({ id: item.id, action: "receive", by: me })} />
              ) : null}
            </ListItemCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.md },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
  });
}
