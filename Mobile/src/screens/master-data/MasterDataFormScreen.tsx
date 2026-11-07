import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { canWriteMaster, useDeleteMaster, useMasterRecords, useSaveMaster } from "@/hooks/use-master-data";
import { masterById, type MasterField, type MasterRecord } from "@/lib/master-data";
import { ChipField, FormScreen, Section, SubmitBar, SwitchField, TextField, errorMessage, fieldError } from "@/components/forms/FormKit";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, spacing, useAppTheme, type AppColors } from "@/theme";
import type { MasterDataStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<MasterDataStackParamList, "MasterForm">;
type Values = Record<string, string | boolean>;

const isNumeric = (f: MasterField) => f.type === "number" || f.type === "percent";
const asNumber = (v: unknown) => Number(String(v).replace(/,/g, ""));

function initialValues(fields: MasterField[], record?: MasterRecord): Values {
  const v: Values = {};
  for (const f of fields) {
    const raw = record ? record[f.key] : f.default;
    if (f.type === "toggle") v[f.key] = Boolean(raw ?? f.default ?? false);
    else v[f.key] = raw == null ? "" : String(raw);
  }
  return v;
}

/** Same coercion as the web form: empty becomes null, numeric fields become numbers. */
function toPayload(fields: MasterField[], values: Values): MasterRecord {
  const out: MasterRecord = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === "toggle") out[f.key] = Boolean(raw);
    else if (raw === "" || raw == null) out[f.key] = null;
    else out[f.key] = isNumeric(f) ? asNumber(raw) : String(raw).trim();
  }
  return out;
}

export default function MasterDataFormScreen({ route, navigation }: Props) {
  const { masterId, recordId } = route.params;
  const master = masterById(masterId);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const records = useMasterRecords(masterId);
  const save = useSaveMaster(masterId);
  const remove = useDeleteMaster(masterId);
  const [values, setValues] = useState<Values>({});
  const [hydrated, setHydrated] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const record = recordId ? (records.data ?? []).find((r) => String(r.id) === recordId) : undefined;

  useEffect(() => {
    if (!master || hydrated) return;
    if (recordId && !record) return;
    setValues(initialValues(master.fields, record));
    setHydrated(true);
  }, [master, recordId, record, hydrated]);

  useEffect(() => {
    if (master) navigation.setOptions({ headerTitle: `${recordId ? "Edit" : "New"} ${master.label.replace(/s$/, "")}` });
  }, [master, recordId, navigation]);

  if (!master) return <ErrorState message="This list is not available." />;
  if (recordId && records.isLoading) return <LoadingState />;
  if (recordId && !record) return <ErrorState message="This record no longer exists." />;
  if (!hydrated) return <LoadingState />;

  const writable = canWriteMaster(master);
  const err = save.error;
  const set = (key: string, v: string | boolean) => setValues((prev) => ({ ...prev, [key]: v }));

  const missing = master.fields.some((f) => f.required && f.type !== "toggle" && String(values[f.key] ?? "").trim() === "");
  const badNumber = master.fields.some((f) => isNumeric(f) && String(values[f.key] ?? "") !== "" && Number.isNaN(asNumber(values[f.key])));

  function submit() {
    if (!master) return;
    save.mutate({ id: recordId, data: toPayload(master.fields, values) }, { onSuccess: () => navigation.goBack() });
  }

  function doDelete() {
    if (!recordId) return;
    remove.mutate(recordId, { onSuccess: () => navigation.goBack() });
  }

  return (
    <FormScreen>
      <Section>
        {master.fields.map((f) => {
          if (f.type === "toggle") {
            return <SwitchField key={f.key} label={f.label} value={Boolean(values[f.key])} onChange={(v) => writable && set(f.key, v)} hint={f.hint} />;
          }
          if (f.type === "select") {
            return (
              <ChipField
                key={f.key}
                label={f.label}
                value={String(values[f.key] ?? "")}
                onChange={(v) => writable && set(f.key, v)}
                options={f.options ?? []}
                required={f.required}
                error={fieldError(err, f.key)}
              />
            );
          }
          return (
            <TextField
              key={f.key}
              label={f.label}
              value={String(values[f.key] ?? "")}
              onChangeText={(v) => set(f.key, v)}
              placeholder={f.placeholder}
              required={f.required}
              hint={f.hint}
              error={fieldError(err, f.key)}
              editable={writable}
              multiline={f.type === "textarea"}
              keyboardType={isNumeric(f) ? "decimal-pad" : f.type === "email" ? "email-address" : f.type === "phone" ? "phone-pad" : undefined}
              autoCapitalize={f.type === "email" || f.type === "phone" || isNumeric(f) ? "none" : "sentences"}
            />
          );
        })}
      </Section>

      {writable ? (
        <SubmitBar
          label={recordId ? "Save changes" : "Create"}
          onPress={submit}
          disabled={missing || badNumber}
          loading={save.isPending}
          error={errorMessage(err)}
        />
      ) : (
        <Text style={styles.note}>You can view this list but not change it.</Text>
      )}

      {writable && recordId && master.remove ? (
        <View style={styles.deleteBox}>
          {confirmDelete ? (
            <>
              <Text style={styles.note}>Delete this record? This cannot be undone.</Text>
              <View style={styles.row}>
                <Button label={remove.isPending ? "Deleting…" : "Yes, delete"} variant="destructive" onPress={doDelete} disabled={remove.isPending} />
                <Button label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
              </View>
              {remove.isError ? <Text style={styles.error}>{errorMessage(remove.error, "Could not delete. It may be in use.")}</Text> : null}
            </>
          ) : (
            <Button label="Delete" icon="trash-2" variant="outline" onPress={() => setConfirmDelete(true)} />
          )}
        </View>
      ) : null}
    </FormScreen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    note: { fontSize: fontSize.base, color: colors.mutedForeground },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    deleteBox: { gap: spacing.sm, marginTop: spacing.lg },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  });
}
