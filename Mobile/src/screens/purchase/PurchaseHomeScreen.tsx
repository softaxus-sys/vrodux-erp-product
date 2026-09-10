import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { PURCHASE_ORDERS_VIEW, PURCHASE_VENDORS_VIEW } from "@/lib/purchase.api";
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
            title="Purchase Orders"
            subtitle="Track orders sent to vendors"
            onPress={() => navigation.navigate("PurchaseOrdersList")}
          />
        ) : null}
        {canVendors ? (
          <MenuCard title="Vendors" subtitle="Look up vendor contacts" onPress={() => navigation.navigate("VendorsList")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function MenuCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]} onPress={onPress}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  menu: { gap: 10 },
  menuCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 16 },
  menuCardPressed: { backgroundColor: "#f9fafb" },
  menuTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  menuSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
