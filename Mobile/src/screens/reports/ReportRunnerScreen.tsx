import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportTable } from "@/components/reports/ReportTable";
import { useRunReport } from "@/hooks/use-reports";
import { REPORT_REGISTRY } from "@/lib/reports.api";
import { Badge, Button, Chip, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ReportsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ReportsStackParamList, "ReportRunner">;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function today(): string {
  return daysAgo(0);
}

export default function ReportRunnerScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { reportId } = route.params;
  const report = REPORT_REGISTRY.find((r) => r.id === reportId);
  navigation.setOptions({ headerTitle: report?.title ?? "Report" });

  // Same 30-days-ago default the web runner seeds a fresh filter panel with.
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [filterValue, setFilterValue] = useState(report?.filter?.options[0]?.value);
  const [numberValue, setNumberValue] = useState(String(report?.numberFilter?.defaultValue ?? ""));

  const run = useRunReport();

  if (!report) {
    return <ErrorState message="Unknown report." />;
  }

  function handleRun() {
    if (!report) return;
    const params: Record<string, string | number> = {};
    if (report.dateRange) {
      params.from = from.trim();
      params.to = to.trim();
    }
    if (report.filter && filterValue) {
      params[report.filter.param] = filterValue;
    }
    if (report.numberFilter) {
      const n = Number(numberValue);
      if (Number.isFinite(n) && n > 0) params[report.numberFilter.param] = n;
    }
    run.mutate({ category: report.category, reportId: report.id, params });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.description}>{report.description}</Text>
      {report.badges?.length || report.regulator ? (
        <View style={styles.badgeRow}>
          {report.badges?.map((b) => (
            <Badge key={b} label={b} tone={b === "Required" ? "warning" : "info"} />
          ))}
          {report.regulator ? <Badge label={report.regulator} tone="neutral" /> : null}
        </View>
      ) : null}

      <SectionCard title="Filters">
        {report.dateRange ? (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>From (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholderTextColor={colors.subtleForeground} />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.label}>To (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={to} onChangeText={setTo} placeholderTextColor={colors.subtleForeground} />
            </View>
          </View>
        ) : null}

        {report.filter ? (
          <View style={styles.filterBlock}>
            <Text style={styles.label}>{report.filter.label}</Text>
            <View style={styles.chipRow}>
              {report.filter.options.map((opt) => (
                <Chip key={opt.value} label={opt.label} active={filterValue === opt.value} onPress={() => setFilterValue(opt.value)} />
              ))}
            </View>
          </View>
        ) : null}

        {report.numberFilter ? (
          <View style={styles.filterBlock}>
            <Text style={styles.label}>{report.numberFilter.label}</Text>
            <TextInput
              style={styles.input}
              value={numberValue}
              onChangeText={setNumberValue}
              keyboardType="number-pad"
              placeholderTextColor={colors.subtleForeground}
            />
          </View>
        ) : null}

        <Button label={run.isPending ? "Running…" : "Run Report"} fullWidth disabled={run.isPending} onPress={handleRun} style={styles.runButton} />
      </SectionCard>

      {run.isPending ? (
        <LoadingState size="small" />
      ) : run.isError ? (
        <ErrorState message="Couldn't run this report." onRetry={handleRun} />
      ) : run.data ? (
        <SectionCard title="Results">
          <ReportTable result={run.data} />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    description: { fontSize: fontSize.base, color: colors.foreground },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

    dateRow: { flexDirection: "row", gap: spacing.sm },
    dateField: { flex: 1, gap: 4 },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.background },

    filterBlock: { gap: spacing.xs, marginTop: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

    runButton: { marginTop: spacing.md },
  });
}
