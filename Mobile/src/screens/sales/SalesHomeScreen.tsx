import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { SALES_ORDERS_VIEW, SALES_QUOTATIONS_VIEW } from "@/lib/sales.api";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "SalesHome">;

export default function SalesHomeScreen({ navigation }: Props) {
  const canOrders = hasPermission(SALES_ORDERS_VIEW);
  const canQuotations = hasPermission(SALES_QUOTATIONS_VIEW);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.menu}>
        {canOrders ? (
          <MenuCard title="Sales Orders" subtitle="Track confirmed orders" onPress={() => navigation.navigate("OrdersList")} />
        ) : null}
        {canQuotations ? (
          <MenuCard
            title="Quotations"
            subtitle="Send, follow up, convert to order"
            onPress={() => navigation.navigate("QuotationsList")}
          />
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
