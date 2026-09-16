import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCloseSession } from "@/hooks/use-pos";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import type { POSSessionDto } from "@/types/pos";
import type { POSStackParamList } from "@/navigation/types";
import { Button, DetailRow } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "CloseShift">;

/** Counted cash defaults to 0 for the no-drawer case, same reasoning as OpenShiftScreen. The
 *  expected/closing/variance summary shown after closing comes straight from the backend's
 *  response (POSSessionDto) -- never computed client-side, so it can never disagree with what the
 *  shift detail screen later shows for the same session. */
export default function CloseShiftScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sessionId } = route.params;
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const [closingCash, setClosingCash] = useState("0");
  const [notes, setNotes] = useState("");
  const [closed, setClosed] = useState<POSSessionDto | null>(null);

  const closeSession = useCloseSession();

  function handleClose() {
    const cash = Number(closingCash);
    closeSession.mutate(
      { sessionId, payload: { closingCash: Number.isFinite(cash) ? cash : 0, notes: notes.trim() || null } },
      { onSuccess: (data) => setClosed(data) },
    );
  }

  if (closed) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Shift closed</Text>
        <View style={styles.summary}>
          <DetailRow label="Expected cash" value={formatCompactValue(closed.expectedCash, currency)} />
          <DetailRow label="Counted cash" value={formatCompactValue(closed.closingCash, currency)} />
          <View style={styles.varianceRow}>
            <Text style={styles.varianceLabel}>Variance</Text>
            <Text
              style={[
                styles.varianceValue,
                { color: closed.cashVariance === 0 ? colors.mutedForeground : closed.cashVariance > 0 ? colors.success : colors.destructive },
              ]}
            >
              {formatCompactValue(closed.cashVariance, currency)}
            </Text>
          </View>
        </View>
        <Button label="Done" onPress={() => navigation.popToTop()} fullWidth />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Close Shift</Text>
      <Text style={styles.subtitle}>No cash drawer? Leave counted cash at 0 -- variance is informational only, nothing blocks closing.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Counted cash</Text>
        <TextInput
          style={styles.input}
          value={closingCash}
          onChangeText={setClosingCash}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.subtleForeground}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholderTextColor={colors.subtleForeground}
        />
      </View>

      {closeSession.isError ? (
        <Text style={styles.errorText}>
          {closeSession.error instanceof Error ? closeSession.error.message : "Couldn't close this shift."}
        </Text>
      ) : null}

      <Button
        label={closeSession.isPending ? "Closing…" : "Close Shift"}
        icon="lock"
        variant="destructive"
        disabled={closeSession.isPending}
        loading={closeSession.isPending}
        onPress={handleClose}
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
    notesInput: { minHeight: 80, textAlignVertical: "top" },

    errorText: { color: colors.destructive, fontSize: fontSize.sm },

    summary: { gap: spacing.xs, backgroundColor: colors.cardMuted, borderRadius: radius.lg, padding: spacing.md },
    varianceRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 5 },
    varianceLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    varianceValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  });
}
