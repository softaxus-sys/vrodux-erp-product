import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useAccount, useAccountDeals, useAccountTimeline, useContactAction, useContacts } from "@/hooks/use-crm-extra";
import { CRM_CUSTOMERS_EDIT } from "@/lib/crm-write.api";
import { CRM_CONTACTS_EDIT } from "@/lib/crm-extra.api";
import { cleanPhone, formatCompactValue } from "@/lib/crm-helpers";
import { ActivityComposer, ActivityRow } from "@/components/crm/ActivityParts";
import { useHeaderActions } from "@/components/forms/useHeaderAction";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "AccountDetail">;

export default function AccountDetailScreen({ route, navigation }: Props) {
  const { accountId, accountName } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const acct = useAccount(accountId);
  const contacts = useContacts(accountId);
  const deals = useAccountDeals(accountId);
  const timeline = useAccountTimeline(accountId);
  const contactAction = useContactAction();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const canEdit = hasPermission(...CRM_CUSTOMERS_EDIT);
  const canContacts = hasPermission(...CRM_CONTACTS_EDIT);

  useEffect(() => navigation.setOptions({ headerTitle: accountName }), [navigation, accountName]);
  useHeaderActions(navigation, [{ label: "Edit", icon: "edit-2", enabled: canEdit, onPress: () => navigation.navigate("AccountForm", { accountId }) }]);

  if (acct.isLoading) return <LoadingState />;
  if (acct.isError || !acct.data) return <ErrorState message="Could not load this account." onRetry={() => acct.refetch()} />;
  const a = acct.data;
  const cur = a.currency ?? "";
  const phone = cleanPhone(a.phone ?? "");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.name}>{a.name}</Text>
        <Text style={styles.sub}>{[a.industry, a.city, a.country].filter(Boolean).join(" · ")}</Text>
        <View style={styles.row}>
          {a.tier ? <Badge label={a.tier} tone="primary" /> : null}
          {a.status ? <Badge label={a.status} tone={a.status.toLowerCase() === "active" ? "success" : "neutral"} /> : null}
        </View>
        <View style={styles.stats}>
          <Stat label="Revenue" value={formatCompactValue(a.totalRevenue ?? 0, cur)} tone="primary" />
          <Stat label="Open deals" value={String(a.openDeals ?? 0)} />
        </View>
      </View>

      <View style={styles.row}>
        <Button icon="phone" label="Call" variant="outline" size="sm" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} />
        <Button icon="mail" label="Email" variant="outline" size="sm" disabled={!a.email} onPress={() => Linking.openURL(`mailto:${a.email}`)} />
        <Button icon="globe" label="Website" variant="outline" size="sm" disabled={!a.website} onPress={() => Linking.openURL(a.website!.startsWith("http") ? a.website! : `https://${a.website}`)} />
      </View>

      <SectionCard title="Details">
        {a.accountManager ? <DetailRow label="Account manager" value={a.accountManager} /> : null}
        {a.phone ? <DetailRow label="Phone" value={a.phone} /> : null}
        {a.email ? <DetailRow label="Email" value={a.email} /> : null}
        {a.address ? <DetailRow label="Address" value={a.address} /> : null}
        {a.description ? <Text style={styles.sub}>{a.description}</Text> : null}
      </SectionCard>

      <SectionCard title={`Contacts${contacts.data ? ` (${contacts.data.length})` : ""}`}>
        {contacts.isLoading ? <LoadingState size="small" /> : (contacts.data ?? []).length === 0 ? <Text style={styles.sub}>No contacts yet.</Text> : (
          (contacts.data ?? []).map((c) => (
            <View key={c.id} style={styles.item}>
              <Text style={styles.itemTitle}>{c.fullName}{c.isPrimary ? "  ★ Primary" : ""}</Text>
              <Text style={styles.sub}>{[c.title, c.department].filter(Boolean).join(" · ")}</Text>
              <View style={styles.row}>
                {c.phone ? <Button icon="phone" label={c.phone} size="sm" variant="ghost" onPress={() => Linking.openURL(`tel:${cleanPhone(c.phone)}`)} /> : null}
                {c.email ? <Button icon="mail" label="Email" size="sm" variant="ghost" onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
              </View>
              {canContacts ? (
                confirmDelete === c.id ? (
                  <View style={styles.row}>
                    <Text style={styles.sub}>Remove this contact?</Text>
                    <Button label="Remove" size="sm" variant="destructive" onPress={() => { contactAction.mutate({ id: c.id, action: "delete" }); setConfirmDelete(null); }} />
                    <Button label="Cancel" size="sm" variant="ghost" onPress={() => setConfirmDelete(null)} />
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Button label="Edit" size="sm" variant="outline" onPress={() => navigation.navigate("ContactForm", { accountId, contactId: c.id })} />
                    {!c.isPrimary ? <Button label="Make primary" size="sm" variant="outline" onPress={() => contactAction.mutate({ id: c.id, action: "primary" })} /> : null}
                    <Button label="Remove" size="sm" variant="ghost" onPress={() => setConfirmDelete(c.id)} />
                  </View>
                )
              ) : null}
            </View>
          ))
        )}
        {canContacts ? <Button icon="user-plus" label="Add contact" variant="outline" onPress={() => navigation.navigate("ContactForm", { accountId })} /> : null}
      </SectionCard>

      <SectionCard title={`Opportunities${deals.data ? ` (${deals.data.length})` : ""}`}>
        {deals.isLoading ? <LoadingState size="small" /> : (deals.data ?? []).length === 0 ? <Text style={styles.sub}>No opportunities linked to this account.</Text> : (
          (deals.data ?? []).map((d: any) => (
            <View key={d.id} style={styles.item}>
              <View style={styles.row}>
                <Text style={[styles.itemTitle, { flex: 1 }]} numberOfLines={1}>{d.title}</Text>
                <Badge label={String(d.stage)} tone={d.stage === "won" ? "success" : d.stage === "lost" ? "destructive" : "info"} />
              </View>
              <Text style={styles.sub}>{formatCompactValue(d.value ?? 0, cur)}{d.expectedCloseDate ? ` · closes ${String(d.expectedCloseDate).slice(0, 10)}` : ""}</Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Log activity">
        <ActivityComposer relatedToType="customer" relatedToId={accountId} relatedToName={a.name} />
      </SectionCard>

      <SectionCard title="Timeline">
        {timeline.isLoading ? <LoadingState size="small" /> : (timeline.data ?? []).length === 0 ? <Text style={styles.sub}>Nothing logged yet.</Text> : (
          (timeline.data ?? []).map((t) => (
            <ActivityRow key={t.id} a={t} origin={t.relatedToType === "customer" ? "Account" : t.relatedToType === "deal" ? "Opportunity" : "Lead"} />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    stats: { flexDirection: "row", gap: spacing.xxl, marginTop: spacing.sm },
    item: { gap: 2, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  });
}
