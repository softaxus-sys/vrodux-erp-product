import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useLgCampaign, useLgCampaignAction } from "@/hooks/use-leadgen";
import { LG_CAMPAIGNS_SEND, lgLabel, lgTone } from "@/lib/leadgen.api";
import { errorMessage } from "@/components/forms/FormKit";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgCampaign">;

export default function LgCampaignScreen({ route, navigation }: Props) {
  const { id, name } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgCampaign(id);
  const act = useLgCampaignAction();
  const [confirm, setConfirm] = useState<"start" | "stop" | null>(null);
  const canSend = hasPermission(...LG_CAMPAIGNS_SEND);

  useEffect(() => navigation.setOptions({ headerTitle: name }), [navigation, name]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message="Could not load this campaign." onRetry={() => q.refetch()} />;
  const c = q.data;

  function run(action: "start" | "pause" | "stop") {
    setConfirm(null);
    act.mutate({ id, action });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Badge label={lgLabel(c.status)} tone={lgTone(c.status)} />
        {c.mailboxAddress ? <Text style={styles.sub}>Sending from {c.mailboxAddress}</Text> : null}
        {c.pauseReason ? <Text style={styles.warn}>{c.pauseReason}</Text> : null}
        <View style={styles.stats}>
          <Stat label="Sent" value={String(c.sent)} />
          <Stat label="Replies" value={`${c.replies} (${c.replyRatePercent.toFixed(1)}%)`} tone="primary" />
          <Stat label="Bounced" value={`${c.counts.bounced} (${c.bounceRatePercent.toFixed(1)}%)`} />
        </View>
      </View>

      {canSend ? (
        <SectionCard title="Control">
          {confirm ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sub}>
                {confirm === "start" ? "Start sending emails to the recipients now?" : "Stop this campaign for good? It cannot be restarted."}
              </Text>
              <View style={styles.row}>
                <Button label={confirm === "start" ? "Yes, start" : "Yes, stop"} variant={confirm === "stop" ? "destructive" : "primary"} onPress={() => run(confirm)} />
                <Button label="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
              </View>
            </View>
          ) : (
            <View style={styles.row}>
              {(c.status === "draft" || c.status === "paused") ? <Button icon="play" label={c.status === "paused" ? "Resume" : "Start"} onPress={() => (c.status === "paused" ? run("start") : setConfirm("start"))} /> : null}
              {c.status === "active" ? <Button icon="pause" label="Pause" variant="outline" onPress={() => run("pause")} /> : null}
              {(c.status === "active" || c.status === "paused") ? <Button icon="square" label="Stop" variant="outline" onPress={() => setConfirm("stop")} /> : null}
            </View>
          )}
          {act.isError ? <Text style={styles.warn}>{errorMessage(act.error, "Could not change the campaign.")}</Text> : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Recipients">
        <DetailRow label="Total" value={String(c.counts.total)} />
        <DetailRow label="Waiting" value={String(c.counts.pending)} />
        <DetailRow label="In sequence" value={String(c.counts.active)} />
        <DetailRow label="Finished" value={String(c.counts.completed)} />
        <DetailRow label="Replied" value={String(c.counts.replied)} />
        <DetailRow label="Unsubscribed" value={String(c.counts.unsubscribed)} />
        <DetailRow label="Failed / skipped" value={String(c.counts.failed + c.counts.skipped)} />
      </SectionCard>

      <SectionCard title="Sending window">
        <DetailRow label="Time" value={`${c.windowStart}–${c.windowEnd} (${c.timeZoneId})`} />
        <DetailRow label="Daily cap" value={String(c.dailyCap)} />
      </SectionCard>

      <SectionCard title={`Emails (${c.steps.length})`}>
        {c.steps.map((s) => (
          <View key={s.id} style={styles.step}>
            <Text style={styles.stepTitle}>
              {s.number}. {s.subject} {s.number > 1 ? `· after ${s.delayDays} day(s)` : ""}
            </Text>
            <Text style={styles.sub} numberOfLines={4}>{s.body}</Text>
          </View>
        ))}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    head: { gap: spacing.sm },
    stats: { flexDirection: "row", gap: spacing.xxl, marginTop: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    warn: { fontSize: fontSize.base, color: colors.warning },
    step: { gap: 2, paddingVertical: spacing.xs },
    stepTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
