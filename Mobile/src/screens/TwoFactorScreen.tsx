import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { authApi } from "@/lib/auth.api";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
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
      <Text style={styles.title}>Two-factor verification</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app for {email}, or one of your backup
        codes.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={10}
        value={code}
        onChangeText={setCode}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSubmit}
        disabled={loading || code.length < 6}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 4,
  },
  error: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  button: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
