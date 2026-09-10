import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { SALES_ORDERS_VIEW, SALES_QUOTATIONS_VIEW } from "@/lib/sales.api";
import { MenuCard } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { SalesStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<SalesStackParamList, "SalesHome">;

export default function SalesHomeScreen({ navigation }: Props) {
  const canOrders = hasPermission(SALES_ORDERS_VIEW);
  const canQuotations = hasPermission(SALES_QUOTATIONS_VIEW);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.menu}>
        {canOrders ? (
          <MenuCard
            icon="shopping-bag"
            title="Sales Orders"
            subtitle="Track confirmed orders"
            tint={colors.primary}
            onPress={() => navigation.navigate("OrdersList")}
          />
        ) : null}
        {canQuotations ? (
          <MenuCard
            icon="file-text"
            title="Quotations"
            subtitle="Send, follow up, convert to order"
            tint={colors.info}
            onPress={() => navigation.navigate("QuotationsList")}
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
