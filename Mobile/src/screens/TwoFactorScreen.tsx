import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { authApi } from "@/lib/auth.api";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "TwoFactor">;

export default function TwoFactorScreen({ route }: Props) {
  const { mfaToken, email } = route.params;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSessionFromAuthResult = useAuthStore((s) => s.setSessionFromAuthResult);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.verifyTwoFactor(mfaToken, code.trim());
      setSessionFromAuthResult(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>
        <Feather name="shield" size={24} color={colors.primary} />
      </View>
      <Text style={styles.title}>Two-factor verification</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app for <Text style={styles.email}>{email}</Text>, or one
        of your backup codes.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        placeholderTextColor={colors.subtleForeground}
        keyboardType="number-pad"
        maxLength={10}
        value={code}
        onChangeText={setCode}
        autoFocus
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button label="Verify" onPress={handleSubmit} loading={loading} disabled={code.length < 6} fullWidth style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground, textAlign: "center" },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground, textAlign: "center", marginBottom: spacing.md, lineHeight: 20 },
  email: { fontWeight: fontWeight.semibold, color: colors.foregroundSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.xxl,
    textAlign: "center",
    letterSpacing: 6,
    color: colors.foreground,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.destructiveSoft,
    borderWidth: 1,
    borderColor: colors.destructiveLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.destructive, fontSize: fontSize.base },
  button: { marginTop: spacing.sm, paddingVertical: spacing.md + 2 },
});
