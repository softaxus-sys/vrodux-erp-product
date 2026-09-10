import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAttendanceToday, useCheckIn, useCheckOut, useMyProfile } from "@/hooks/use-hr-self";
import { hasPermission } from "@/store/auth.store";
import { HR_SELF_ATTENDANCE, HR_SELF_LEAVE, HR_SELF_PAYSLIP, HR_SELF_VIEW } from "@/lib/hr.api";
import { ApiError } from "@/lib/api-client";
import { NOT_LINKED_ERROR_CODE } from "@/types/hr";
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
        <Text style={styles.notLinkedTitle}>Not linked yet</Text>
        <Text style={styles.notLinkedText}>
          Your login is not linked to an employee record. Ask HR to link your account, then come
          back here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {canViewProfile ? (
        profile.isLoading ? (
          <ActivityIndicator />
        ) : profile.data ? (
          <View style={styles.profileCard}>
            <Text style={styles.name}>{profile.data.fullName}</Text>
            <Text style={styles.subtitle}>
              {[profile.data.jobTitle, profile.data.departmentName].filter(Boolean).join(" · ") || profile.data.employeeNumber}
            </Text>
          </View>
        ) : null
      ) : null}

      {canAttendance ? (
        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>Today</Text>
          {today.isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <View style={styles.todayRow}>
                <TodayStat label="Check in" value={today.data?.checkIn ?? "—"} />
                <TodayStat label="Check out" value={today.data?.checkOut ?? "—"} />
              </View>
              {today.data?.lateMinutes != null ? (
                <Text style={today.data.lateMinutes > 0 ? styles.late : styles.onTime}>
                  {today.data.lateMinutes > 0 ? `Late by ${today.data.lateMinutes} min` : "On time"}
                </Text>
              ) : null}
              <View style={styles.todayButtons}>
                <Pressable
                  style={[styles.checkButton, today.data?.checkIn && styles.checkButtonDisabled]}
                  disabled={Boolean(today.data?.checkIn) || checkIn.isPending}
                  onPress={() => checkIn.mutate()}
                >
                  <Text style={styles.checkButtonText}>{checkIn.isPending ? "..." : "Check In"}</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.checkButton,
                    (!today.data?.checkIn || Boolean(today.data?.checkOut)) && styles.checkButtonDisabled,
                  ]}
                  disabled={!today.data?.checkIn || Boolean(today.data?.checkOut) || checkOut.isPending}
                  onPress={() => checkOut.mutate()}
                >
                  <Text style={styles.checkButtonText}>{checkOut.isPending ? "..." : "Check Out"}</Text>
                </Pressable>
              </View>
              {(checkIn.isError || checkOut.isError) && (
                <Text style={styles.errorText}>Could not record that. Try again.</Text>
              )}
            </>
          )}
        </View>
      ) : null}

      <View style={styles.menu}>
        {canAttendance ? (
          <MenuCard title="Attendance" subtitle="History and check-in/out" onPress={() => navigation.navigate("Attendance")} />
        ) : null}
        {canLeave ? (
          <MenuCard title="Leave" subtitle="Balances and requests" onPress={() => navigation.navigate("Leave")} />
        ) : null}
        {canPayslip ? (
          <MenuCard title="Payslips" subtitle="Salary history" onPress={() => navigation.navigate("Payslips")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function TodayStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.todayStatLabel}>{label}</Text>
      <Text style={styles.todayStatValue}>{value}</Text>
    </View>
  );
}

function MenuCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]} onPress={onPress}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  notLinkedTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  notLinkedText: { fontSize: 14, color: "#6b7280", textAlign: "center" },

  profileCard: { gap: 2 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },

  todayCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, gap: 8 },
  todayLabel: { fontSize: 12, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  todayRow: { flexDirection: "row", gap: 32 },
  todayStatLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  todayStatValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  late: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  onTime: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  todayButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  checkButton: { flex: 1, backgroundColor: "#111827", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  checkButtonDisabled: { backgroundColor: "#e5e7eb" },
  checkButtonText: { color: "#fff", fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 12 },

  menu: { gap: 10 },
  menuCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 16 },
  menuCardPressed: { backgroundColor: "#f9fafb" },
  menuTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  menuSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
