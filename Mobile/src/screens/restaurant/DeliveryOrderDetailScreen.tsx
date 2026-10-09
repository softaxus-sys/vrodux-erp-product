import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAssignDriver, useChangeDeliveryStatus, useDeliveryOrder, useDrivers } from "@/hooks/use-restaurant";
import { ApiError } from "@/lib/api-client";
import { RESTAURANT_DELIVERY_EDIT } from "@/lib/restaurant.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_TONE, nextDeliveryStatus } from "@/types/restaurant";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "DeliveryOrderDetail">;

export default function DeliveryOrderDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { deliveryOrderId, orderNumber } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: orderNumber });
  }, [navigation, orderNumber]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const canEdit = hasPermission(RESTAURANT_DELIVERY_EDIT);

  const delivery = useDeliveryOrder(deliveryOrderId);
  const assignDriver = useAssignDriver();
  const changeStatus = useChangeDeliveryStatus();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (delivery.isLoading || !delivery.data) {
    return <LoadingState />;
  }
  if (delivery.isError) {
    return <ErrorState message="Couldn't load this delivery." onRetry={() => delivery.refetch()} />;
  }

  const d = delivery.data;
  const next = nextDeliveryStatus(d.status);
  const terminal = d.status === "delivered" || d.status === "failed";
  const error =
    assignDriver.error instanceof ApiError ? assignDriver.error.message : changeStatus.error instanceof ApiError ? changeStatus.error.message : null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{d.customerName ?? d.orderNumber}</Text>
          <View style={styles.subtitleRow}>
            <Badge label={DELIVERY_STATUS_LABELS[d.status] ?? d.status} tone={DELIVERY_STATUS_TONE[d.status] ?? "neutral"} />
            <Text style={styles.subtitle}>{d.orderNumber}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <SectionCard title="Drop-off">
          <DetailRow label="Address" value={d.address} />
          <DetailRow label="Phone" value={d.phone} />
          {d.deliveryZoneName ? <DetailRow label="Zone" value={d.deliveryZoneName} /> : null}
          <DetailRow label="To collect" value={formatCompactValue(d.amountToCollect, currency)} />
          {d.orderNotes ? <DetailRow label="Notes" value={d.orderNotes} /> : null}
        </SectionCard>

        <SectionCard title="Rider">
          <DetailRow label="Driver" value={d.driverName ?? "Not assigned"} />
          {canEdit && !terminal ? (
            <Button label={d.driverId ? "Reassign Rider" : "Assign Rider"} size="sm" variant="outline" onPress={() => setPickerOpen(true)} style={styles.actionGap} />
          ) : null}
        </SectionCard>

        {d.items && d.items.length > 0 ? (
          <SectionCard title={`Items (${d.items.length})`}>
            {d.items.map((item, i) => (
              <DetailRow key={i} label={`${item.quantity}× ${item.name}`} value={item.notes ?? ""} />
            ))}
          </SectionCard>
        ) : null}

        {canEdit && !terminal ? (
          <View style={styles.actionRow}>
            {next ? (
              <Button
                label={`Mark ${DELIVERY_STATUS_LABELS[next]}`}
                disabled={changeStatus.isPending}
                onPress={() => changeStatus.mutate({ id: d.id, status: next })}
              />
            ) : null}
            <Button
              label="Mark Failed"
              variant="destructive"
              disabled={changeStatus.isPending}
              onPress={() => changeStatus.mutate({ id: d.id, status: "failed" })}
            />
          </View>
        ) : null}
      </ScrollView>

      <DriverPickerModal
        visible={pickerOpen}
        currentDriverId={d.driverId}
        busy={assignDriver.isPending}
        onSelect={(driverId) => assignDriver.mutate({ id: d.id, driverId }, { onSuccess: () => setPickerOpen(false) })}
        onCancel={() => setPickerOpen(false)}
      />
    </>
  );
}

function DriverPickerModal({
  visible,
  currentDriverId,
  busy,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  currentDriverId: string | null;
  busy: boolean;
  onSelect: (driverId: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const drivers = useDrivers(true, visible);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Assign a Rider</Text>
          {drivers.isLoading ? (
            <LoadingState size="small" />
          ) : drivers.isError ? (
            <Text style={styles.errorBannerText}>Couldn't load drivers.</Text>
          ) : (drivers.data ?? []).length === 0 ? (
            <Text style={styles.subtitle}>No active drivers on file.</Text>
          ) : (
            (drivers.data ?? []).map((driver) => (
              <Pressable key={driver.id} style={styles.driverRow} disabled={busy} onPress={() => onSelect(driver.id)}>
                <View>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverMeta}>
                    {driver.phone} · {driver.activeDeliveries} active
                  </Text>
                </View>
                {driver.id === currentDriverId ? <Text style={styles.linkedTag}>Current</Text> : null}
              </Pressable>
            ))
          )}
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },

    errorBanner: { backgroundColor: colors.destructive, borderRadius: 10, padding: spacing.sm },
    errorBannerText: { color: "#fff", fontSize: fontSize.sm },

    actionRow: { flexDirection: "row", gap: spacing.sm },
    actionGap: { marginTop: spacing.sm, alignSelf: "flex-start" },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    driverRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    driverName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    driverMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    linkedTag: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
  });
}
