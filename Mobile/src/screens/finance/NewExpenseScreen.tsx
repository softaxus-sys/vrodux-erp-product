import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCreateExpense } from "@/hooks/use-finance";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/types/finance";
import type { ExpenseCategory } from "@/types/finance";
import { Button, Chip } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/theme";
import type { FinanceStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<FinanceStackParamList, "NewExpense">;

// Dynamic, never hardcoded -- see CLAUDE.md's "never hardcode dates" rule.
const TODAY = new Date().toISOString().split("T")[0];

export default function NewExpenseScreen({ navigation }: Props) {
  const createExpense = useCreateExpense();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(TODAY);
  const [paidBy, setPaidBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const amountValue = Number(amount);
  const canSubmit =
    title.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(expenseDate);

  function submit() {
    createExpense.mutate(
      {
        title: title.trim(),
        category,
        amount: amountValue,
        expenseDate,
        paidBy: paidBy.trim() || undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => navigation.goBack() }
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Field label="Title">
        <TextInput
          style={styles.input}
          placeholder="e.g. Client visit taxi"
          placeholderTextColor={colors.subtleForeground}
          value={title}
          onChangeText={setTitle}
        />
      </Field>

      <Field label="Category">
        <View style={styles.chipRow}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c} label={EXPENSE_CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </Field>

      <Field label="Amount">
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={colors.subtleForeground}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      </Field>

      <Field label="Date">
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.subtleForeground}
          value={expenseDate}
          onChangeText={setExpenseDate}
          autoCapitalize="none"
        />
      </Field>

      <Field label="Paid by (optional)">
        <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={colors.subtleForeground} value={paidBy} onChangeText={setPaidBy} />
      </Field>

      <Field label="Payment method (optional)">
        <TextInput
          style={styles.input}
          placeholder="Cash, card, bank transfer…"
          placeholderTextColor={colors.subtleForeground}
          value={paymentMethod}
          onChangeText={setPaymentMethod}
        />
      </Field>

      <Field label="Reference (optional)">
        <TextInput
          style={styles.input}
          placeholder="Receipt / invoice number"
          placeholderTextColor={colors.subtleForeground}
          value={reference}
          onChangeText={setReference}
        />
      </Field>

      <Field label="Notes (optional)">
        <TextInput style={[styles.input, styles.multiline]} placeholderTextColor={colors.subtleForeground} value={notes} onChangeText={setNotes} multiline />
      </Field>

      <Button
        label={createExpense.isPending ? "Submitting..." : "Submit expense"}
        onPress={submit}
        disabled={!canSubmit || createExpense.isPending}
        loading={createExpense.isPending}
        fullWidth
        style={styles.submitButton}
      />
      {createExpense.isError ? <Text style={styles.errorText}>Couldn&apos;t submit this expense. Check the fields and try again.</Text> : null}
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl + spacing.md },
  field: { gap: spacing.xs + 2 },
  fieldLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foregroundSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: fontSize.lg,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  submitButton: { marginTop: spacing.xs, paddingVertical: spacing.md },
  errorText: { color: colors.destructive, fontSize: fontSize.sm, textAlign: "center" },
});
