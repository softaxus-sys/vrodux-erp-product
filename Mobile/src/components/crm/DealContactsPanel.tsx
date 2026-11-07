import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useContacts, useDealContactMutations, useDealContacts } from "@/hooks/use-crm-extra";
import { DEAL_CONTACT_ROLES } from "@/lib/crm-extra.api";
import { cleanPhone } from "@/lib/crm-helpers";
import { Button, Chip, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/** The people involved in an opportunity and the part each plays (decision maker, champion, blocker…). */
export function DealContactsPanel({ dealId, customerId, canEdit }: { dealId: string; customerId?: string | null; canEdit: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const linked = useDealContacts(dealId);
  const accountContacts = useContacts(customerId ?? undefined);
  const { add, setRole, remove } = useDealContactMutations(dealId);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [role, setRoleState] = useState("decision_maker");

  const linkedIds = new Set((linked.data ?? []).map((c) => c.contactId));
  const available = (accountContacts.data ?? []).filter((c) => !linkedIds.has(c.id));
  const roleLabel = (v: string) => DEAL_CONTACT_ROLES.find((r) => r.value === v)?.label ?? v;

  return (
    <SectionCard title={`People involved${linked.data ? ` (${linked.data.length})` : ""}`}>
      {linked.isLoading ? <LoadingState size="small" /> : (linked.data ?? []).length === 0 ? (
        <Text style={styles.sub}>No contacts attached to this opportunity.</Text>
      ) : (
        (linked.data ?? []).map((c) => (
          <View key={c.id} style={styles.item}>
            <Text style={styles.name}>{c.fullName}{c.isPrimary ? "  ★" : ""}</Text>
            <Text style={styles.sub}>{[c.title, c.email].filter(Boolean).join(" · ")}</Text>
            {canEdit ? (
              <View style={styles.chips}>
                {DEAL_CONTACT_ROLES.map((r) => (
                  <Chip key={r.value} label={r.label} active={c.role === r.value} onPress={() => c.role !== r.value && setRole.mutate({ id: c.id, role: r.value })} />
                ))}
              </View>
            ) : (
              <Text style={styles.role}>{roleLabel(c.role)}</Text>
            )}
            <View style={styles.chips}>
              {c.phone ? <Button icon="phone" label="Call" size="sm" variant="ghost" onPress={() => Linking.openURL(`tel:${cleanPhone(c.phone)}`)} /> : null}
              {c.email ? <Button icon="mail" label="Email" size="sm" variant="ghost" onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
              {canEdit ? <Button label="Remove" size="sm" variant="ghost" onPress={() => remove.mutate(c.id)} disabled={remove.isPending} /> : null}
            </View>
          </View>
        ))
      )}

      {canEdit ? (
        !customerId ? (
          <Text style={styles.sub}>Link this opportunity to an account to attach its contacts.</Text>
        ) : adding ? (
          <View style={{ gap: spacing.sm }}>
            {available.length === 0 ? <Text style={styles.sub}>All of this account's contacts are already attached.</Text> : (
              <View style={styles.chips}>
                {available.map((c) => <Chip key={c.id} label={c.fullName} active={pick === c.id} onPress={() => setPick(c.id)} />)}
              </View>
            )}
            <View style={styles.chips}>
              {DEAL_CONTACT_ROLES.map((r) => <Chip key={r.value} label={r.label} active={role === r.value} onPress={() => setRoleState(r.value)} />)}
            </View>
            {add.isError ? <Text style={styles.error}>Could not add this contact.</Text> : null}
            <View style={styles.chips}>
              <Button label={add.isPending ? "Adding…" : "Add"} disabled={!pick || add.isPending} onPress={() => pick && add.mutate({ contactId: pick, role }, { onSuccess: () => { setAdding(false); setPick(null); } })} />
              <Button label="Cancel" variant="ghost" onPress={() => { setAdding(false); setPick(null); }} />
            </View>
          </View>
        ) : (
          <Button icon="user-plus" label="Add a contact" variant="outline" onPress={() => setAdding(true)} />
        )
      ) : null}
    </SectionCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    item: { gap: 4, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    role: { fontSize: fontSize.base, color: colors.primary },
    chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    error: { fontSize: fontSize.sm, color: colors.destructive },
  });
}
