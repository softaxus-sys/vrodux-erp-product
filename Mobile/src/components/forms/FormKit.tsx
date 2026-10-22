import { useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ApiError } from "@/lib/api-client";
import { Button, Chip } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/**
 * Shared building blocks for every create / edit screen, so a new form is a list of fields and one
 * submit call rather than 150 lines of StyleSheet. Server validation arrives as `ApiError.fieldErrors`
 * (keys lower-cased); pass `fieldError(err, "name")` as `error` and the message lands on that field.
 */

export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split("T")[0];
}

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function toNumber(v: string): number {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Message to show above the submit button for any failed mutation. */
export function errorMessage(err: unknown, fallback = "Could not save. Check the fields and try again."): string | null {
  if (!err) return null;
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

export function fieldError(err: unknown, name: string): string | undefined {
  return err instanceof ApiError ? err.fieldError(name) : undefined;
}

// ── Screen wrapper ──────────────────────────────────────────────────────────────────────────────
export function FormScreen({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.section}>
      {title ? <Text style={s.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────────────────────────
interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  secure?: boolean;
}

export function TextField({
  label, value, onChangeText, placeholder, required, error, hint, keyboardType, multiline, autoCapitalize, editable = true, secure,
}: TextFieldProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <TextInput
        style={[s.input, multiline && s.multiline, !!error && s.inputError, !editable && s.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtleForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? (keyboardType === "email-address" ? "none" : "sentences")}
        editable={editable}
        secureTextEntry={secure}
      />
    </Field>
  );
}

export const NumberField = (p: Omit<TextFieldProps, "keyboardType">) => (
  <TextField {...p} keyboardType="decimal-pad" autoCapitalize="none" />
);

/** YYYY-MM-DD text box with quick chips -- a native date picker would add a dependency for little gain. */
export function DateField({
  label,
  value,
  onChange,
  required,
  error,
  quick = [
    { label: "Today", days: 0 },
    { label: "+7d", days: 7 },
    { label: "+30d", days: 30 },
  ],
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  quick?: { label: string; days: number }[];
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const invalid = value.length > 0 && !isIsoDate(value);
  return (
    <Field label={label} required={required} error={error ?? (invalid ? "Use the format YYYY-MM-DD" : undefined)}>
      <TextInput
        style={[s.input, (invalid || !!error) && s.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.subtleForeground}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      {quick.length ? (
        <View style={s.chipRow}>
          {quick.map((q) => (
            <Chip key={q.label} label={q.label} onPress={() => onChange(todayIso(q.days))} />
          ))}
        </View>
      ) : null}
    </Field>
  );
}

export function ChipField<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
  error,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  required?: boolean;
  error?: string;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <Field label={label} required={required} error={error}>
      <View style={s.chipRow}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </Field>
  );
}

export function SwitchField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

// ── Searchable picker (customers, vendors, products, users, ...) ────────────────────────────────
export interface PickOption {
  id: string;
  label: string;
  sub?: string;
}

export function PickerField({
  label,
  placeholder = "Select…",
  value,
  onChange,
  options,
  onSearch,
  loading,
  required,
  error,
  allowClear = true,
}: {
  label: string;
  placeholder?: string;
  /** Selected option (kept by the caller so a server-searched list can drop it from `options`). */
  value: PickOption | null;
  onChange: (v: PickOption | null) => void;
  options: PickOption[];
  /** When set the list is searched on the server; otherwise it filters `options` locally. */
  onSearch?: (q: string) => void;
  loading?: boolean;
  required?: boolean;
  error?: string;
  allowClear?: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = onSearch
    ? options
    : options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Field label={label} required={required} error={error}>
      <Pressable style={[s.input, s.pickerBtn, !!error && s.inputError]} onPress={() => setOpen(true)}>
        <Text style={[s.pickerText, !value && { color: colors.subtleForeground }]} numberOfLines={1}>
          {value ? value.label : placeholder}
        </Text>
        {value && allowClear ? (
          <Pressable hitSlop={10} onPress={() => onChange(null)}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : (
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        )}
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{label}</Text>
            <Pressable hitSlop={10} onPress={() => setOpen(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <TextInput
            style={[s.input, { margin: spacing.lg, marginTop: 0 }]}
            value={q}
            onChangeText={(t) => {
              setQ(t);
              onSearch?.(t);
            }}
            placeholder="Search"
            placeholderTextColor={colors.subtleForeground}
            autoFocus
          />
          <FlatList
            data={shown}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[s.hint, { textAlign: "center", marginTop: spacing.xl }]}>{loading ? "Loading…" : "Nothing found"}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={s.optionRow}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQ("");
                }}
              >
                <Text style={s.optionLabel}>{item.label}</Text>
                {item.sub ? <Text style={s.hint}>{item.sub}</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </Field>
  );
}

// ── Submit ──────────────────────────────────────────────────────────────────────────────────────
export function SubmitBar({
  label,
  onPress,
  disabled,
  loading,
  error,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      {error ? <Text style={[s.error, { textAlign: "center" }]}>{error}</Text> : null}
      <Button label={loading ? "Saving…" : label} onPress={onPress} disabled={disabled || loading} loading={loading} fullWidth />
    </View>
  );
}

function styles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
    section: { gap: spacing.lg },
    sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground, marginTop: spacing.sm },
    field: { gap: spacing.xs + 2 },
    label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foregroundSecondary },
    hint: { fontSize: fontSize.sm, color: colors.mutedForeground },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      fontSize: fontSize.lg,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
    inputError: { borderColor: colors.destructive },
    inputDisabled: { opacity: 0.6 },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    pickerText: { flex: 1, fontSize: fontSize.lg, color: colors.foreground },
    modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
    modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    optionRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 2,
    },
    optionLabel: { fontSize: fontSize.lg, color: colors.foreground, fontWeight: fontWeight.medium },
  });
}
