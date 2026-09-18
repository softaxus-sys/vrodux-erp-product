import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ISSUE_PRIORITY_TONE, ISSUE_TYPE_ICON, type IssueSummaryDto } from "@/types/project-management";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** Shared between Board and Backlog -- same compact card the web app's issue-card.tsx renders on
 *  both surfaces. `onMove` (optional) renders a small "..." button opening a column/sprint picker
 *  -- the touch equivalent of the web app's drag-and-drop, which doesn't translate to a phone. */
export function IssueCard({ issue, onPress, onMove }: { issue: IssueSummaryDto; onPress: () => void; onMove?: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const priorityTone = ISSUE_PRIORITY_TONE[issue.priority];
  const priorityColor =
    priorityTone === "destructive" ? colors.destructive : priorityTone === "warning" ? colors.warning : priorityTone === "info" ? colors.info : colors.subtleForeground;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.keyRow}>
          <Feather name={ISSUE_TYPE_ICON[issue.type] as keyof typeof Feather.glyphMap} size={12} color={colors.mutedForeground} />
          <Text style={styles.key}>{issue.issueKey}</Text>
        </View>
        {onMove ? (
          <Pressable onPress={onMove} hitSlop={8} style={styles.moveButton}>
            <Feather name="more-horizontal" size={16} color={colors.subtleForeground} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{issue.title}</Text>
      {issue.labels.length > 0 ? (
        <View style={styles.labelRow}>
          {issue.labels.slice(0, 3).map((l) => (
            <View key={l.id} style={[styles.labelChip, { backgroundColor: `${l.color}22` }]}>
              <Text style={[styles.labelText, { color: l.color }]} numberOfLines={1}>{l.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Feather name="flag" size={11} color={priorityColor} />
        {issue.storyPoints != null ? <Text style={styles.meta}>{issue.storyPoints} pts</Text> : null}
        {issue.dueDate ? <Text style={styles.meta}>{issue.dueDate}</Text> : null}
        <View style={styles.spacer} />
        {issue.assigneeName ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(issue.assigneeName)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      gap: 6,
    },
    top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    keyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    key: { fontSize: fontSize.xs, color: colors.mutedForeground, fontWeight: fontWeight.medium },
    moveButton: { padding: 2 },
    title: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground, lineHeight: 17 },

    labelRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    labelChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, maxWidth: 100 },
    labelText: { fontSize: 10, fontWeight: fontWeight.semibold },

    bottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
    meta: { fontSize: fontSize.xs, color: colors.subtleForeground },
    spacer: { flex: 1 },
    avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 9, fontWeight: fontWeight.bold, color: colors.onPrimary },
  });
}
