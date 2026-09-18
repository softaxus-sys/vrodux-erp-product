import { useEffect, useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVendor } from "@/hooks/use-purchase";
import { cleanPhone } from "@/lib/crm-helpers";
import type { PurchaseStackParamList } from "@/navigation/types";
import { Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<PurchaseStackParamList, "VendorDetail">;

export default function VendorDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { vendorId, vendorName } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: vendorName });
  }, [navigation, vendorName]);

  const vendor = useVendor(vendorId);

  if (vendor.isLoading || !vendor.data) {
    return <LoadingState />;
  }
  if (vendor.isError) {
    return <ErrorState message="Couldn't load this vendor." onRetry={() => vendor.refetch()} />;
  }

  const v = vendor.data;
  const phone = cleanPhone(v.phone);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{v.name}</Text>
        <Text style={styles.subtitle}>{[v.category, v.status].filter(Boolean).join(" · ")}</Text>
        <View style={styles.statsRow}>
          <Stat label="Rating" value={v.rating > 0 ? `★ ${v.rating.toFixed(1)}` : "—"} />
          <Stat label="Orders" value={String(v.purchaseOrderCount)} />
          <Stat label="Payment terms" value={v.paymentTerms || "—"} />
          <Stat label="Currency" value={v.currency} />
        </View>
      </View>

      <SectionCard title="Contact">
        <View style={styles.actionsRow}>
          <Button label="Call" icon="phone" variant="outline" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.actionButton} />
          <Button label="Email" icon="mail" variant="outline" disabled={!v.email} onPress={() => Linking.openURL(`mailto:${v.email}`)} style={styles.actionButton} />
        </View>
        {v.contactPerson ? <DetailRow label="Contact person" value={v.contactPerson} /> : null}
        {v.address ? <DetailRow label="Address" value={v.address} /> : null}
        {v.taxNumber ? <DetailRow label="Tax number" value={v.taxNumber} /> : null}
      </SectionCard>

      {v.notes ? (
        <SectionCard title="Notes">
          <Text style={styles.bodyText}>{v.notes}</Text>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground, textTransform: "capitalize" },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    actionsRow: { flexDirection: "row", gap: spacing.sm },
    actionButton: { flex: 1 },
  });
}
