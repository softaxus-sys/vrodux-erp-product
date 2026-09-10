import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { authApi } from "@/lib/auth.api";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSessionFromAuthResult = useAuthStore((s) => s.setSessionFromAuthResult);
  const setMfaToken = useAuthStore((s) => s.setMfaToken);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.login(email.trim(), password);

      // Two-phase login (Module 14): a 2FA-enabled account gets no tokens yet,
      // just a short-lived mfaToken scoped to /auth/verify-2fa only.
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        navigation.navigate("TwoFactor", { mfaToken: result.mfaToken, email: email.trim() });
        return;
      }

      setSessionFromAuthResult(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <BrandMark size={64} />
          <Text style={styles.title}>Vrodux ERP</Text>
          <Text style={styles.subtitle}>Sign in to your workspace</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={colors.subtleForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={colors.subtleForeground}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={16} color={colors.subtleForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.subtleForeground}
                secureTextEntry={!showPassword}
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
              />
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={16}
                color={colors.subtleForeground}
                style={styles.inputTrailingIcon}
                onPress={() => setShowPassword((v) => !v)}
                suppressHighlighting
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="Sign In"
            onPress={handleSubmit}
            loading={loading}
            disabled={!email || !password}
            fullWidth
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.xxl },

  brandBlock: { alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSize.xxxl, fontWeight: fontWeight.extrabold, color: colors.foreground, marginTop: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },

  form: { gap: spacing.lg },
  field: { gap: spacing.xs + 2 },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foregroundSecondary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  inputTrailingIcon: { marginLeft: spacing.sm, padding: spacing.xs },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.lg, color: colors.foreground },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.destructiveSoft,
    borderWidth: 1,
    borderColor: colors.destructiveLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.destructive, fontSize: fontSize.base, flexShrink: 1 },

  submitButton: { marginTop: spacing.xs, paddingVertical: spacing.md + 2 },
});
