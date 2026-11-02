import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCrmReport } from "@/hooks/use-crm-extra";
import { reportDef, type ReportFmt } from "@/lib/crm-reports";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { Chip, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "CrmReport">;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86400000));

// Computed fresh on each render so "last 30 days" never goes stale on a screen left open overnight.
const PRESETS: { key: string; label: string; range: () => { from?: string; to?: string } }[] = [
  { key: "all", label: "All time", range: () => ({}) },
  { key: "30d", label: "Last 30 days", range: () => ({ from: daysAgo(30), to: ymd(new Date()) }) },
  { key: "90d", label: "Last 90 days", range: () => ({ from: daysAgo(90), to: ymd(new Date()) }) },
  { key: "month", label: "This month", range: () => { const n = new Date(); return { from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; } },
  { key: "year", label: "This year", range: () => { const n = new Date(); return { from: ymd(new Date(n.getFullYear(), 0, 1)), to: ymd(n) }; } },
];

export default function CrmReportScreen({ route }: Props) {
  const def = reportDef(route.params.reportId);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [preset, setPreset] = useState("30d");
  const range = (PRESETS.find((p) => p.key === preset) ?? PRESETS[0]).range();
  const q = useCrmReport(route.params.reportId, range.from, range.to);

  if (!def) return <ErrorState message="This report is not available." />;

  const fmt = (v: unknown, f: ReportFmt = "text"): string => {
    if (v == null || v === "") return "—";
    if (f === "text") return String(v).replace(/_/g, " ");
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (f === "money") return formatCompactValue(n, currency);
    if (f === "pct") return `${Math.round(n * 10) / 10}%`;
    if (f === "days") return `${Math.round(n * 10) / 10} d`;
    return String(Math.round(n * 10) / 10);
  };

  const d = q.data;
  const note = d && def.note ? def.note(d) : null;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}>
      <View style={styles.chips}>
        {PRESETS.map((p) => <Chip key={p.key} label={p.label} active={preset === p.key} onPress={() => setPreset(p.key)} />)}
      </View>
      <Text style={styles.note}>{def.rangeNote}.</Text>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !d ? (
        <ErrorState message="Could not load this report." onRetry={() => q.refetch()} />
      ) : (
        <>
          {note ? <Text style={styles.warn}>{note}</Text> : null}
          <View style={styles.tiles}>
            {def.tiles.map((t) => (
              <View key={t.field} style={styles.tile}>
                <Text style={[styles.tileValue, t.primary && { color: colors.primary }]}>{fmt(d[t.field], t.fmt)}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
          {def.tables.map((tb) => {
            const rows = (d[tb.field] as Record<string, unknown>[] | undefined) ?? [];
            if (rows.length === 0) return null;
            const [first, ...rest] = tb.columns;
            return (
              <SectionCard key={tb.field} title={`${tb.title} (${rows.length})`}>
                {rows.slice(0, 40).map((r, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{fmt(r[first.field], first.fmt ?? "text")}</Text>
                    <Text style={styles.rowSub}>{rest.map((c) => `${c.label} ${fmt(r[c.field], c.fmt)}`).join(" · ")}</Text>
                  </View>
                ))}
                {rows.length > 40 ? <Text style={styles.note}>Showing the first 40 of {rows.length}. See the web app for the full table and export.</Text> : null}
              </SectionCard>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    note: { fontSize: fontSize.sm, color: colors.mutedForeground },
    warn: { fontSize: fontSize.base, color: colors.warning },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.cardMuted, borderRadius: radius.lg, padding: spacing.md },
    tileValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    tileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    row: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
    rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    rowSub: { fontSize: fontSize.sm, color: colors.mutedForeground },
  });
}
