import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCompactValue } from "@/lib/crm-helpers";
import { MODULES } from "@/lib/module-browser";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { ErrorState, LoadingState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ExtraStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ExtraStackParamList, "ModuleHome">;

const allowed = (perms: string[]) => perms.length === 0 || hasPermission(...perms);

export default function ModuleHomeScreen({ route, navigation }: Props) {
  const spec = MODULES[route.params.moduleKey];
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const summary = useQuery({
    queryKey: ["module-summary", spec.key],
    queryFn: () => apiClient.get<Record<string, number>>(spec.summary!.path()),
    enabled: Boolean(spec.summary),
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {spec.summary ? (
        summary.isLoading ? (
          <LoadingState size="small" />
        ) : summary.isError ? (
          <ErrorState message="Couldn't load the overview." onRetry={() => summary.refetch()} />
        ) : (
          <View style={styles.tileGrid}>
            {spec.summary.tiles.map((t) => {
              const raw = Number(summary.data?.[t.field] ?? 0);
              return (
                <View key={t.label} style={styles.tile}>
                  <Text style={[styles.tileValue, { color: colors.primary }]}>{t.money ? formatCompactValue(raw, currency) : String(raw)}</Text>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                </View>
              );
            })}
          </View>
        )
      ) : null}

      <View style={styles.menu}>
        {(spec.extras ?? []).filter((e) => allowed(e.permission)).map((e) => (
          <MenuCard key={e.route} icon={e.icon} title={e.title} subtitle={e.subtitle} tint={colors.success} onPress={() => navigation.navigate(e.route as never)} />
        ))}
        {spec.lists.filter((l) => allowed(l.permission)).map((l) => (
          <MenuCard key={l.key} icon={l.icon} title={l.title} subtitle={l.subtitle} tint={colors.primary} onPress={() => navigation.navigate("ModuleList", { listKey: l.key })} />
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: 12, padding: spacing.md },
    tileValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    menu: { gap: spacing.sm, marginTop: spacing.sm },
  });
}
