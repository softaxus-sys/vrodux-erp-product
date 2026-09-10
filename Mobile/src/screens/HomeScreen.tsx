import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { authApi } from "@/lib/auth.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Placeholder landing screen -- proves the auth flow end to end (login / 2FA
 * / token refresh / logout) against the real gateway. Swap this out for the
 * first real module screen (e.g. HR self-service or CRM leads, per the
 * phase-1 plan) rather than growing it in place.
 */
export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const permissions = useAuthStore((s) => s.permissions);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    if (refreshToken && accessToken) {
      await authApi.revoke(refreshToken, accessToken);
    }
    logout();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Welcome, {user?.fullName ?? "—"}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Tenant</Text>
        <Text style={styles.value}>{tenant?.name ?? "—"}</Text>

        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{tenant?.plan ?? "—"}</Text>

        <Text style={styles.label}>Modules ({tenant?.modules.length ?? 0})</Text>
        <Text style={styles.value}>{tenant?.modules.join(", ") || "—"}</Text>

        <Text style={styles.label}>Permission keys ({permissions.length})</Text>
        <Text style={styles.value}>{permissions.slice(0, 8).join(", ") || "—"}</Text>
      </View>

      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  label: { fontSize: 12, color: "#6b7280", marginTop: 8, textTransform: "uppercase" },
  value: { fontSize: 15, color: "#111827" },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
