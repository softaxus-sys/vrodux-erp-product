import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useOpenSession } from "@/hooks/use-pos";
import { useAuthStore } from "@/store/auth.store";
import type { POSStackParamList } from "@/navigation/types";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "OpenShift">;

/**
 * Mirrors web's OpenShiftScreen (shift-gate.tsx) logic without its cash-denomination counter --
 * that UI exists for a real till float, and the businesses this mobile checkout targets have no
 * physical drawer at all. Starting cash defaults to 0, which the backend fully accepts
 * (OpenSessionCommandValidator only requires >= 0, confirmed by reading it directly) -- leaving it
 * at 0 is a legitimate, supported choice, not a workaround.
 */
export default function OpenShiftScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  // Defaulted per-user so two staff opening a shift from their own phones don't collide on the
  // backend's one-open-session-per-register rule by both leaving the field at a shared default --
  // still freely editable.
  const defaultRegister = `Mobile-${(user?.fullName?.split(" ")[0] || "1").trim()}`;
  const [registerId, setRegisterId] = useState(defaultRegister);
  const [openingCash, setOpeningCash] = useState("0");

  const openSession = useOpenSession();

  function handleOpen() {
    const cash = Number(openingCash);
    openSession.mutate(
      { registerId: registerId.trim() || defaultRegister, openingCash: Number.isFinite(cash) ? cash : 0 },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Open Shift</Text>
      <Text style={styles.subtitle}>
        No cash drawer? Leave starting cash at 0 -- it's fully supported, and the shift will simply
        report zero variance when you close it.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Register</Text>
        <TextInput
          style={styles.input}
          value={registerId}
          onChangeText={setRegisterId}
          placeholder="e.g. Mobile-1"
          placeholderTextColor={colors.subtleForeground}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Starting cash</Text>
        <TextInput
          style={styles.input}
          value={openingCash}
          onChangeText={setOpeningCash}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.subtleForeground}
        />
      </View>

      {openSession.isError ? (
        <Text style={styles.errorText}>
          {openSession.error instanceof Error ? openSession.error.message : "Couldn't open a shift."}
        </Text>
      ) : null}

      <Button
        label={openSession.isPending ? "Opening…" : "Open Shift"}
        icon="unlock"
        disabled={!registerId.trim() || openSession.isPending}
        loading={openSession.isPending}
        onPress={handleOpen}
        fullWidth
      />
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitle: { fontSize: fontSize.sm, color: colors.mutedForeground },

    field: { gap: spacing.xs },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.mutedForeground },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.base,
      color: colors.foreground,
      backgroundColor: colors.card,
    },

    errorText: { color: colors.destructive, fontSize: fontSize.sm },
  });
}
