import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContractsSummary, usePropertiesSummary } from "@/hooks/use-real-estate";
import {
  REAL_ESTATE_BROKERS_VIEW,
  REAL_ESTATE_CONTRACTS_VIEW,
  REAL_ESTATE_PROPERTIES_VIEW,
  REAL_ESTATE_RENT_VIEW,
  REAL_ESTATE_TENANTS_VIEW,
  REAL_ESTATE_UNITS_VIEW,
} from "@/lib/real-estate.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "RealEstateHome">;

/** Portfolio browsing + rent collection, not a leasing back-office. Property/unit/tenant/contract
 *  creation are all real multi-field forms -- desktop-appropriate, same call as Sales/Purchase
 *  order creation -- so this is scoped to what a property manager actually does away from a desk:
 *  check occupancy, look up a tenant or lease, and chase/record rent. */
export default function RealEstateHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const canProperties = hasPermission(REAL_ESTATE_PROPERTIES_VIEW);
  const canUnits = hasPermission(REAL_ESTATE_UNITS_VIEW);
  const canTenants = hasPermission(REAL_ESTATE_TENANTS_VIEW);
  const canContracts = hasPermission(REAL_ESTATE_CONTRACTS_VIEW);
  const canRent = hasPermission(REAL_ESTATE_RENT_VIEW);
  const canBrokers = hasPermission(REAL_ESTATE_BROKERS_VIEW);

  const properties = usePropertiesSummary(canProperties);
  const contracts = useContractsSummary(canContracts);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Overview</Text>
      {properties.isLoading || contracts.isLoading ? (
        <LoadingState size="small" />
      ) : properties.isError || contracts.isError ? (
        <ErrorState message="Couldn't load the overview." onRetry={() => (properties.isError ? properties.refetch() : contracts.refetch())} />
      ) : (
        <View style={styles.tileGrid}>
          {properties.data ? (
            <>
              <Tile label="Occupancy" value={`${Math.round(properties.data.occupancyRate)}%`} tone={colors.primary} />
              <Tile label="Units" value={`${properties.data.occupiedUnits}/${properties.data.totalUnits}`} tone={colors.info} />
            </>
          ) : null}
          {contracts.data ? (
            <>
              <Tile label="Overdue rent" value={formatCompactValue(contracts.data.overdueAmount, currency)} tone={colors.destructive} />
              <Tile label="Due this month" value={formatCompactValue(contracts.data.dueThisMonthAmount, currency)} tone={colors.warning} />
            </>
          ) : null}
        </View>
      )}

      <View style={styles.menu}>
        {canProperties ? (
          <MenuCard icon="home" title="Properties" subtitle="Portfolio, occupancy, units" tint={colors.primary} onPress={() => navigation.navigate("PropertiesList")} />
        ) : null}
        {canUnits ? (
          <MenuCard icon="grid" title="Units" subtitle="Every unit, across properties" tint={colors.info} onPress={() => navigation.navigate("UnitsList")} />
        ) : null}
        {canTenants ? (
          <MenuCard icon="users" title="Tenants" subtitle="Contacts and lease history" tint={colors.success} onPress={() => navigation.navigate("TenantsList")} />
        ) : null}
        {canContracts ? (
          <MenuCard icon="file-text" title="Contracts" subtitle="Leases and rent schedules" tint={colors.mutedForeground} onPress={() => navigation.navigate("ContractsList")} />
        ) : null}
        {canRent ? (
          <MenuCard icon="alert-circle" title="Rent Due" subtitle="The chase queue -- overdue and upcoming" tint={colors.destructive} onPress={() => navigation.navigate("RentDue")} />
        ) : null}
        {canBrokers ? (
          <MenuCard icon="user" title="Brokers" subtitle="Agents, ratings, commissions" tint={colors.warning} onPress={() => navigation.navigate("BrokersList")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },

    tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    tileValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
