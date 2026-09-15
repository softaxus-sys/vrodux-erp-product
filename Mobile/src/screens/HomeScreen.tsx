import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { authApi } from "@/lib/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { BrandMark } from "@/components/brand/BrandMark";
import { Badge, Button, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { AppTabParamList } from "@/navigation/types";

/**
 * Placeholder landing screen -- proves the auth flow end to end (login / 2FA / token refresh /
 * logout) against the real gateway, and now gives the module/permission data a real layout while
 * it's still standing in for actual KPI cards. Swap the "Session diagnostics" card out once real
 * dashboard content lands (see README "Next module").
 */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Props = BottomTabScreenProps<AppTabParamList, "Dashboard">;

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const permissions = useAuthStore((s) => s.permissions);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const mustSetUpTwoFactor = useAuthStore((s) => s.mustSetUpTwoFactor);
  const clearMustSetUpTwoFactor = useAuthStore((s) => s.clearMustSetUpTwoFactor);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    if (refreshToken && accessToken) {
      await authApi.revoke(refreshToken, accessToken);
    }
    logout();
  }

  const firstName = user?.fullName?.split(" ")[0] ?? user?.fullName ?? "there";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <BrandMark size={44} />
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {greeting()}, {firstName}
          </Text>
          <Text style={styles.tenantLine}>{tenant?.name ?? "—"}</Text>
        </View>
      </View>

      {mustSetUpTwoFactor ? (
        <View style={styles.twoFactorBanner}>
          <View style={styles.twoFactorHeader}>
            <Feather name="shield" size={18} color={colors.warning} />
            <Text style={styles.twoFactorText}>Your workspace now requires two-factor authentication. Set it up to keep your session.</Text>
          </View>
          <Button
            label="Set up now"
            size="sm"
            onPress={() => {
              clearMustSetUpTwoFactor();
              navigation.navigate("Settings");
            }}
          />
        </View>
      ) : null}

      <SectionCard title="Workspace">
        <Detail label="Plan" value={tenant?.plan ?? "—"} />
        <Detail label="Currency" value={tenant?.currency ?? "—"} />
        <View style={styles.moduleBlock}>
          <Text style={styles.detailLabel}>Modules ({tenant?.modules.length ?? 0})</Text>
          <View style={styles.chipRow}>
            {tenant?.modules.length ? (
              tenant.modules.map((m) => <Badge key={m} label={m} tone="primary" dot={false} />)
            ) : (
              <Text style={styles.mutedText}>None enabled.</Text>
            )}
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Session diagnostics">
        <Detail label="Permission keys" value={String(permissions.length)} />
        {permissions.length > 0 ? (
          <Text style={styles.permissionsPreview} numberOfLines={3}>
            {permissions.slice(0, 10).join(", ")}
            {permissions.length > 10 ? "…" : ""}
          </Text>
        ) : null}
      </SectionCard>

      <View style={styles.signOutRow}>
        <Button label="Sign out" variant="outline" icon="log-out" onPress={handleLogout} fullWidth />
      </View>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
    headerText: { flex: 1 },
    greeting: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    tenantLine: { fontSize: fontSize.md, color: colors.mutedForeground, marginTop: 2 },

    twoFactorBanner: { gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md },
    twoFactorHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    twoFactorText: { flex: 1, fontSize: fontSize.base, color: colors.foreground },

    detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    detailLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    detailValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },

    moduleBlock: { marginTop: spacing.xs, gap: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    mutedText: { fontSize: fontSize.base, color: colors.subtleForeground },

    permissionsPreview: { fontSize: fontSize.sm, color: colors.subtleForeground, marginTop: spacing.xs, lineHeight: 16 },

    signOutRow: { marginTop: spacing.sm },
  });
}
