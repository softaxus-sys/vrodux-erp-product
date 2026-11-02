import { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLgCampaigns } from "@/hooks/use-leadgen";
import { lgLabel, lgTone } from "@/lib/leadgen.api";
import { Badge, EmptyListState, ErrorState, ListItemCard, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgCampaigns">;

export default function LgCampaignsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgCampaigns();

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message="Could not load campaigns." onRetry={() => q.refetch()} />;

  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ paddingVertical: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={<EmptyListState title="No campaigns" subtitle="Build campaigns on the web app, then run them from here." />}
      renderItem={({ item: c }) => (
        <ListItemCard onPress={() => navigation.navigate("LgCampaign", { id: c.id, name: c.name })}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            <Badge label={lgLabel(c.status)} tone={lgTone(c.status)} />
          </View>
          <Text style={styles.sub}>
            {c.counts.total} recipients · {c.sent} sent · {c.replies} replies ({c.replyRatePercent.toFixed(1)}%)
          </Text>
          {c.pauseReason ? <Text style={styles.warn}>{c.pauseReason}</Text> : null}
        </ListItemCard>
      )}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    name: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    warn: { fontSize: fontSize.base, color: colors.warning },
  });
}
