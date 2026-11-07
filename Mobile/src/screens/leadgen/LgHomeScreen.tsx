import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useLgDashboard, useLgInboxCounts } from "@/hooks/use-leadgen";
import {
  LG_CAMPAIGNS_VIEW, LG_CREDITS_VIEW, LG_INBOX_VIEW, LG_MAILBOXES_VIEW, LG_PROSPECTS_VIEW, LG_REPORTS_VIEW, LG_SEARCHES_VIEW,
} from "@/lib/leadgen.api";
import { ErrorState, LoadingState, MenuCard, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgHome">;

export default function LgHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canDash = hasPermission(...LG_REPORTS_VIEW, ...LG_PROSPECTS_VIEW, ...LG_SEARCHES_VIEW, ...LG_CREDITS_VIEW, ...LG_CAMPAIGNS_VIEW);
  const canInbox = hasPermission(...LG_INBOX_VIEW);
  const dash = useLgDashboard(canDash);
  const counts = useLgInboxCounts(canInbox);
  const d = dash.data;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => dash.refetch()} tintColor={colors.primary} />}
    >
      {canDash ? (
        dash.isLoading ? (
          <LoadingState size="small" />
        ) : dash.isError || !d ? (
          <ErrorState message="Couldn't load the overview." onRetry={() => dash.refetch()} />
        ) : (
          <>
            <View style={styles.tiles}>
              <Tile styles={styles} label="Credits" value={String(d.balance)} />
              <Tile styles={styles} label="Emails sent (30d)" value={String(d.sent)} />
              <Tile styles={styles} label="Replies" value={`${d.replies} · ${d.replyRatePercent.toFixed(1)}%`} />
              <Tile styles={styles} label="Interested" value={String(d.interested)} />
            </View>
            <SectionCard title="Funnel">
              {(["discovered", "revealed", "contacted", "replied", "qualified", "converted"] as const).map((k) => (
                <View key={k} style={styles.funnelRow}>
                  <Text style={styles.funnelLabel}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                  <Text style={styles.funnelValue}>{d.funnel[k]}</Text>
                </View>
              ))}
            </SectionCard>
            {d.attention.length > 0 ? (
              <SectionCard title="Needs attention">
                {d.attention.map((a, i) => (
                  <Text key={i} style={styles.attention}>• {a}</Text>
                ))}
              </SectionCard>
            ) : null}
          </>
        )
      ) : null}

      <View style={styles.menu}>
        {hasPermission(...LG_PROSPECTS_VIEW) ? (
          <MenuCard icon="users" title="Prospects" subtitle="Businesses found, reveal contacts, add to CRM" onPress={() => navigation.navigate("LgProspects")} />
        ) : null}
        {hasPermission(...LG_SEARCHES_VIEW) ? (
          <MenuCard icon="search" title="Find businesses" subtitle="Run a search by area and category" onPress={() => navigation.navigate("LgSearches")} />
        ) : null}
        {hasPermission(...LG_CAMPAIGNS_VIEW) ? (
          <MenuCard icon="send" title="Campaigns" subtitle="Email sequences: start, pause, stop" onPress={() => navigation.navigate("LgCampaigns")} />
        ) : null}
        {canInbox ? (
          <MenuCard
            icon="inbox"
            title="Inbox"
            subtitle={counts.data ? `${counts.data.unread} unread · ${counts.data.replies} replies` : "Replies from prospects"}
            onPress={() => navigation.navigate("LgInbox")}
          />
        ) : null}
        {hasPermission(...LG_CREDITS_VIEW) ? (
          <MenuCard icon="database" title="Credits" subtitle="Balance and history" onPress={() => navigation.navigate("LgCredits")} />
        ) : null}
        {hasPermission(...LG_MAILBOXES_VIEW) ? (
          <MenuCard icon="mail" title="Mailboxes" subtitle="Sending status and daily limits" onPress={() => navigation.navigate("LgMailboxes")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Tile({ styles, label, value }: { styles: ReturnType<typeof createStyles>; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: radius.lg, padding: spacing.md },
    tileValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    funnelRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
    funnelLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    funnelValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    attention: { fontSize: fontSize.base, color: colors.foreground },
    menu: { gap: spacing.sm },
  });
}
