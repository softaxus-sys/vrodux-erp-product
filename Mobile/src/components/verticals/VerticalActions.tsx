import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { hasPermission } from "@/store/auth.store";
import { NEXT_STEPS, VERTICAL_FORMS, type NextStep } from "@/lib/vertical-forms";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { errorMessage } from "@/components/forms/FormKit";
import { fontSize, fontWeight, spacing, useAppTheme } from "@/theme";

/** Puts "New" in the header of a pack's list screen when the user may create that record. */
export function useVerticalNew(formKey: string) {
  const navigation = useNavigation<{ navigate: (name: string, params: object) => void; setOptions: (o: object) => void }>();
  useHeaderActions(navigation, [
    { label: "New", enabled: VERTICAL_FORMS[formKey].permission === "" || hasPermission(VERTICAL_FORMS[formKey].permission), onPress: () => navigation.navigate("VerticalForm", { formKey }) },
  ]);
}

/** The forward step(s) the web table offers for a row's current status (if any, and if permitted). */
export function NextStepBar({ formKey, id, status, record }: { formKey: string; id: string; status: string; record?: Record<string, unknown> }) {
  const steps = (NEXT_STEPS[formKey] ?? []).filter((s) => s.from.includes(status) && (s.permission === "" || hasPermission(s.permission)));
  if (steps.length === 0) return null;
  return (
    <View style={styles.row}>
      {steps.map((s) => <StepButton key={s.label} step={s} id={id} record={record ?? {}} />)}
    </View>
  );
}

function StepButton({ step, id, record }: { step: NextStep; id: string; record: Record<string, unknown> }) {
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: async () => {
      const body = typeof step.body === "function" ? step.body(record) : step.body ?? {};
      const url = step.path(id);
      if (step.method === "POST") await apiClient.post(url, body);
      else await apiClient.patch(url, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [step.queryKey] }),
  });
  const press = () => {
    if (!step.confirm) return run.mutate();
    Alert.alert(step.label, step.confirm, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => run.mutate() }]);
  };
  return (
    <View style={styles.wrap}>
      <Pressable onPress={press} disabled={run.isPending} style={[styles.btn, { borderColor: colors.primary, opacity: run.isPending ? 0.5 : 1 }]}>
        <Text style={[styles.text, { color: colors.primary }]}>{run.isPending ? "Working…" : step.label}</Text>
      </Pressable>
      {run.isError ? <Text style={[styles.err, { color: colors.destructive }]}>{errorMessage(run.error)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wrap: { marginTop: -spacing.xs, marginBottom: spacing.sm, alignItems: "flex-start", gap: 4 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  text: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  err: { fontSize: fontSize.sm },
});
