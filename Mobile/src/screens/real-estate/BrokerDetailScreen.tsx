import { useEffect, useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { Button, DetailRow, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "BrokerDetail">;

export default function BrokerDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { broker: b } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: b.name });
  }, [navigation, b.name]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{b.name}</Text>
        <View style={styles.subtitleRow}>
          <Feather name="star" size={14} color={colors.warning} />
          <Text style={styles.rating}>{b.rating.toFixed(1)}</Text>
          <Text style={styles.subtitle}>· {b.agency}</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Deals" value={String(b.dealsCompleted)} />
          <Stat label="Commission" value={formatCompactValue(b.totalCommission, currency)} tone="primary" />
          <Stat label="Rate" value={`${b.commissionRate}%`} />
        </View>
      </View>

      <View style={styles.quickActions}>
        <Button icon="phone" label={b.phone} variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${b.phone}`)} />
        <Button icon="mail" label="Email" variant="outline" size="sm" onPress={() => Linking.openURL(`mailto:${b.email}`)} />
      </View>

      <SectionCard title="Details">
        <DetailRow label="Broker #" value={b.brokerNumber} />
        <DetailRow label="Specialization" value={b.specialization} />
        <DetailRow label="License #" value={b.licenseNumber} />
        <DetailRow label="License Expiry" value={b.licenseExpiry} />
        <DetailRow label="Status" value={b.status} />
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    rating: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },

    quickActions: { flexDirection: "row", gap: spacing.sm },
  });
}
