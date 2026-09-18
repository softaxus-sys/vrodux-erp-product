import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ReportResult } from "@/types/reports";

const COLUMN_WIDTH = 140;
// A phone screen can't render an unbounded result set readably -- capped rather than paginated,
// same "keep it readable" call CLAUDE.md made deferring Trial Balance/Financial Statements from
// the Finance module entirely. Unlike those, these reports ARE genuinely runnable here; the cap
// is just a rendering limit, not a missing feature -- narrowing the date range gets the rest.
const MAX_RENDERED_ROWS = 200;

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

export function ReportTable({ result }: { result: ReportResult }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rows = result.rows.slice(0, MAX_RENDERED_ROWS);

  if (result.rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No rows for this filter.</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[styles.row, styles.headerRow]}>
            {result.columns.map((col) => (
              <View key={col} style={styles.cell}>
                <Text style={styles.headerText} numberOfLines={2}>
                  {col}
                </Text>
              </View>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
              {result.columns.map((col) => (
                <View key={col} style={styles.cell}>
                  <Text style={styles.cellText} numberOfLines={2}>
                    {formatCell(row[col])}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.footer}>
        {result.rows.length > MAX_RENDERED_ROWS
          ? `Showing first ${MAX_RENDERED_ROWS} of ${result.totalCount} rows — narrow the date range for the rest.`
          : `${result.totalCount} row${result.totalCount === 1 ? "" : "s"}`}
      </Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    headerRow: { backgroundColor: colors.cardMuted },
    rowAlt: { backgroundColor: colors.cardMuted },
    cell: { width: COLUMN_WIDTH, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: "center" },
    headerText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase" },
    cellText: { fontSize: fontSize.sm, color: colors.foreground },
    footer: { fontSize: fontSize.xs, color: colors.subtleForeground, textAlign: "center", paddingVertical: spacing.sm },
    empty: { padding: spacing.xl, alignItems: "center" },
    emptyText: { fontSize: fontSize.base, color: colors.mutedForeground },
  });
}
