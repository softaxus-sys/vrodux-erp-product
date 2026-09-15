import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from "@/hooks/use-notifications";
import { ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { AppNotificationDto } from "@/types/notifications";

const TYPE_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  mention: "at-sign",
  success: "check-circle",
  warning: "alert-triangle",
  error: "alert-circle",
  info: "info",
};

/**
 * Presented as a modal from the header bell (see RootNavigator.tsx), the same pattern as the AI
 * assistant. Reuses CRM's existing per-user "bell" feed (`GET /api/crm/notifications`) rather than
 * a new cross-module table -- today that means every notification shown here originated from CRM's
 * lead-alert pipeline (the one trigger this pass wired to mobile push too); see the Push
 * Notifications section of Mobile/README.md for what other modules are NOT wired up yet and why.
 */
export default function NotificationsScreen({
  onClose,
  onOpenLead,
}: {
  onClose: () => void;
  onOpenLead: (leadId: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading, isError, refetch, isRefetching } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function handlePress(n: AppNotificationDto) {
    if (!n.read) markRead.mutate(n.id);
    if (n.relatedToType === "lead" && n.relatedToId) {
      onClose();
      onOpenLead(n.relatedToId);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {data && data.unreadCount > 0 && (
            <Pressable style={styles.headerButton} onPress={() => markAllRead.mutate()} hitSlop={8}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
          <Pressable style={styles.headerButton} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Couldn't load notifications." onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bell-off" size={28} color={colors.subtleForeground} />
          <Text style={styles.emptyText}>Nothing here yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {data.items.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => handlePress(n)}
            >
              <View style={[styles.iconWrap, !n.read && styles.iconWrapUnread]}>
                <Feather
                  name={TYPE_ICON[n.type] ?? "bell"}
                  size={15}
                  color={n.read ? colors.subtleForeground : colors.primary}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={2}>{n.title}</Text>
                {!!n.message && <Text style={styles.rowMessage} numberOfLines={2}>{n.message}</Text>}
                <Text style={styles.rowDate}>{new Date(n.createdAt).toLocaleString()}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    headerButton: { padding: spacing.xs },
    markAllText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.primary },

    list: { padding: spacing.lg, gap: spacing.sm },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "flex-start",
    },
    rowUnread: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    iconWrap: {
      width: 30, height: 30, borderRadius: radius.full,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.muted,
    },
    iconWrapUnread: { backgroundColor: colors.card },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    rowMessage: { fontSize: fontSize.sm, color: colors.mutedForeground },
    rowDate: { fontSize: fontSize.xs, color: colors.subtleForeground, marginTop: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 4 },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.subtleForeground },
  });
}
