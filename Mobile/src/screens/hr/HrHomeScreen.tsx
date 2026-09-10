import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAttendanceToday, useCheckIn, useCheckOut, useMyProfile } from "@/hooks/use-hr-self";
import { hasPermission } from "@/store/auth.store";
import { HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP, HR_SELF_VIEW } from "@/lib/hr.api";
import { ApiError } from "@/lib/api-client";
import { NOT_LINKED_ERROR_CODE } from "@/types/hr";
import { Badge, Button, Card, LoadingState, MenuCard } from "@/components/ui";
import { colors, fontSize, fontWeight, spacing } from "@/theme";
import type { HrStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<HrStackParamList, "HrHome">;

export default function HrHomeScreen({ navigation }: Props) {
  const canViewProfile = hasPermission(HR_SELF_VIEW);
  const canAttendance = hasPermission(HR_SELF_ATTENDANCE);
  const canLeave = hasPermission(HR_SELF_LEAVE);
  const canPayslip = hasPermission(HR_SELF_PAYSLIP);

  const profile = useMyProfile();
  const today = useAttendanceToday();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const notLinked =
    profile.isError && profile.error instanceof ApiError && profile.error.errorCode === NOT_LINKED_ERROR_CODE;

  if (notLinked) {
    return (
      <View style={styles.centered}>
        <View style={styles.notLinkedIcon}>
          <Feather name="user-x" size={22} color={colors.subtleForeground} />
        </View>
        <Text style={styles.notLinkedTitle}>Not linked yet</Text>
        <Text style={styles.notLinkedText}>
          Your login is not linked to an employee record. Ask HR to link your account, then come back here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {canViewProfile ? (
        profile.isLoading ? (
          <LoadingState size="small" />
        ) : profile.data ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile.data.fullName)}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.name}>{profile.data.fullName}</Text>
              <Text style={styles.subtitle}>
                {[profile.data.jobTitle, profile.data.departmentName].filter(Boolean).join(" · ") || profile.data.employeeNumber}
              </Text>
            </View>
          </View>
        ) : null
      ) : null}

      {canAttendance ? (
        <Card style={styles.todayCard}>
          <View style={styles.todayHeaderRow}>
            <Text style={styles.todayLabel}>Today</Text>
            {today.data?.lateMinutes != null ? (
              <Badge label={today.data.lateMinutes > 0 ? `Late ${today.data.lateMinutes}m` : "On time"} tone={today.data.lateMinutes > 0 ? "warning" : "success"} />
            ) : null}
          </View>
          {today.isLoading ? (
            <LoadingState size="small" />
          ) : (
            <>
              <View style={styles.todayRow}>
                <TodayStat label="Check in" value={today.data?.checkIn ?? "—"} />
                <TodayStat label="Check out" value={today.data?.checkOut ?? "—"} />
              </View>
              <View style={styles.todayButtons}>
                <Button
                  label={checkIn.isPending ? "..." : "Check In"}
                  icon="log-in"
                  onPress={() => checkIn.mutate()}
                  disabled={Boolean(today.data?.checkIn) || checkIn.isPending}
                  fullWidth
                  style={styles.todayButton}
                />
                <Button
                  label={checkOut.isPending ? "..." : "Check Out"}
                  icon="log-out"
                  variant="secondary"
                  onPress={() => checkOut.mutate()}
                  disabled={!today.data?.checkIn || Boolean(today.data?.checkOut) || checkOut.isPending}
                  fullWidth
                  style={styles.todayButton}
                />
              </View>
              {(checkIn.isError || checkOut.isError) && (
                <Text style={styles.errorText}>Could not record that. Try again.</Text>
              )}
            </>
          )}
        </Card>
      ) : null}

      <View style={styles.menu}>
        {canAttendance ? (
          <MenuCard icon="calendar" title="Attendance" subtitle="History and check-in/out" onPress={() => navigation.navigate("Attendance")} />
        ) : null}
        {canLeave ? (
          <MenuCard icon="sun" title="Leave" subtitle="Balances and requests" tint={colors.info} onPress={() => navigation.navigate("Leave")} />
        ) : null}
        {canPayslip ? (
          <MenuCard icon="file-text" title="Payslips" subtitle="Salary history" tint={colors.success} onPress={() => navigation.navigate("Payslips")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function TodayStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.todayStatLabel}>{label}</Text>
      <Text style={styles.todayStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  notLinkedIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  notLinkedTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
  notLinkedText: { fontSize: fontSize.md, color: colors.mutedForeground, textAlign: "center" },

  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xs },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  profileText: { flex: 1 },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground, marginTop: 2 },

  todayCard: { gap: spacing.sm },
  todayHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todayLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },
  todayRow: { flexDirection: "row", gap: spacing.xxxl },
  todayStatLabel: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase" },
  todayStatValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: 2 },
  todayButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  todayButton: { flex: 1 },
  errorText: { color: colors.destructive, fontSize: fontSize.sm },

  menu: { gap: spacing.sm + 2 },
});
