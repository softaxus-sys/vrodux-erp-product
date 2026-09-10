import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCreateExpense } from "@/hooks/use-finance";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/types/finance";
import type { ExpenseCategory } from "@/types/finance";
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
        <TextInput style={styles.input} placeholder="e.g. Client visit taxi" value={title} onChangeText={setTitle} />
      </Field>

      <Field label="Category">
        <View style={styles.chipRow}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Amount">
        <TextInput
          style={styles.input}
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      </Field>

      <Field label="Date">
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={expenseDate}
          onChangeText={setExpenseDate}
          autoCapitalize="none"
        />
      </Field>

      <Field label="Paid by (optional)">
        <TextInput style={styles.input} placeholder="Your name" value={paidBy} onChangeText={setPaidBy} />
      </Field>

      <Field label="Payment method (optional)">
        <TextInput style={styles.input} placeholder="Cash, card, bank transfer…" value={paymentMethod} onChangeText={setPaymentMethod} />
      </Field>

      <Field label="Reference (optional)">
        <TextInput style={styles.input} placeholder="Receipt / invoice number" value={reference} onChangeText={setReference} />
      </Field>

      <Field label="Notes (optional)">
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline />
      </Field>

      <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} disabled={!canSubmit || createExpense.isPending} onPress={submit}>
        <Text style={styles.submitButtonText}>{createExpense.isPending ? "Submitting..." : "Submit expense"}</Text>
      </Pressable>
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
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#f3f4f6" },
  chipActive: { backgroundColor: "#111827" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  submitButton: { backgroundColor: "#111827", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  submitButtonDisabled: { backgroundColor: "#e5e7eb" },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorText: { color: "#dc2626", fontSize: 12, textAlign: "center" },
});
