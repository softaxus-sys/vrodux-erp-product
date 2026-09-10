import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { PURCHASE_ORDERS_VIEW, PURCHASE_VENDORS_VIEW } from "@/lib/purchase.api";
import { MenuCard } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { PurchaseStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<PurchaseStackParamList, "PurchaseHome">;

export default function PurchaseHomeScreen({ navigation }: Props) {
  const canOrders = hasPermission(PURCHASE_ORDERS_VIEW);
  const canVendors = hasPermission(PURCHASE_VENDORS_VIEW);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.menu}>
        {canOrders ? (
          <MenuCard
            icon="clipboard"
            title="Purchase Orders"
            subtitle="Track orders sent to vendors"
            tint={colors.primary}
            onPress={() => navigation.navigate("PurchaseOrdersList")}
          />
        ) : null}
        {canVendors ? (
          <MenuCard
            icon="truck"
            title="Vendors"
            subtitle="Look up vendor contacts"
            tint={colors.info}
            onPress={() => navigation.navigate("VendorsList")}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  menu: { gap: spacing.sm + 2 },
});
