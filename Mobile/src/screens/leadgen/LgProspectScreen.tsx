import { useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { hasPermission } from "@/store/auth.store";
import { useLgImportToCrm, useLgProspect, useLgReveal, useLgUpdateProspect, useLgWallet } from "@/hooks/use-leadgen";
import {
  LG_PROSPECTS_EDIT, LG_PROSPECTS_IMPORT, LG_PROSPECTS_REVEAL, MANUAL_STATUSES, lgLabel, lgTone, scoreTone, type ProspectStatus,
} from "@/lib/leadgen.api";
import { cleanPhone } from "@/lib/crm-helpers";
import { errorMessage } from "@/components/forms/FormKit";
import { Badge, Button, Chip, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgProspect">;

export default function LgProspectScreen({ route, navigation }: Props) {
  const { id, name } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const q = useLgProspect(id);
  const wallet = useLgWallet(hasPermission("leadgen.credits.view"));
  const reveal = useLgReveal();
  const importCrm = useLgImportToCrm();
  const update = useLgUpdateProspect();
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => navigation.setOptions({ headerTitle: name }), [navigation, name]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState message="Could not load this prospect." onRetry={() => q.refetch()} />;
  const p = q.data;

  const canReveal = hasPermission(...LG_PROSPECTS_REVEAL) && !p.isRevealed && !p.suppressed;
  const canEdit = hasPermission(...LG_PROSPECTS_EDIT);
  const canImport = hasPermission(...LG_PROSPECTS_IMPORT) && p.isRevealed && !p.crmLeadId;
  const cost = wallet.data?.revealCost;
  const phone = cleanPhone(p.phone ?? "");

  function doReveal() {
    setConfirmReveal(false);
    reveal.mutate([id], {
      onSuccess: (r) => {
        const item = r.items[0];
        setResult(
          item?.outcome === "revealed" ? `Revealed. ${r.creditsSpent} credit(s) used, ${r.balance} left.`
          : item?.outcome === "refunded" ? "No usable contact was found, so the credits were refunded."
          : item?.outcome === "insufficient_credits" ? "Not enough credits. Top up from the web app (Billing)."
          : item?.message ?? "Nothing was revealed.",
        );
      },
    });
  }

  function doImport() {
    importCrm.mutate([id], {
      onSuccess: (r) =>
        setResult(r.created ? "Added to CRM as a lead." : r.duplicates ? "Already in CRM." : r.notRevealed ? "Reveal the contact first." : "Could not add to CRM."),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{p.name}</Text>
        <Text style={styles.sub}>{[p.categoryLabel, p.area, p.city].filter(Boolean).join(" · ")}</Text>
        <View style={styles.row}>
          <Badge label={lgLabel(p.status)} tone={lgTone(p.status)} />
          <Badge label={`Quality ${p.qualityScore}`} tone={scoreTone(p.qualityScore)} dot={false} />
          <Badge label={`Fit ${p.fitScore}`} tone={scoreTone(p.fitScore)} dot={false} />
        </View>
      </View>

      {result ? <Text style={styles.result}>{result}</Text> : null}
      {reveal.isError ? <Text style={styles.error}>{errorMessage(reveal.error, "Could not reveal.")}</Text> : null}
      {importCrm.isError ? <Text style={styles.error}>{errorMessage(importCrm.error, "Could not add to CRM.")}</Text> : null}

      <SectionCard title="Contact">
        {p.isRevealed ? (
          <>
            {p.phone ? <DetailRow label="Phone" value={p.phone} /> : null}
            {p.email ? <DetailRow label="Email" value={`${p.email} (${p.emailStatus})`} /> : null}
            {p.website ? <DetailRow label="Website" value={p.website} /> : null}
            {p.address ? <DetailRow label="Address" value={p.address} /> : null}
            {(p.contacts ?? []).map((c) => (
              <DetailRow key={c.id} label={c.title ?? "Contact"} value={[c.fullName, c.email, c.phone].filter(Boolean).join(" · ")} />
            ))}
            <View style={styles.row}>
              <Button icon="phone" label="Call" variant="outline" size="sm" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} />
              <Button icon="mail" label="Email" variant="outline" size="sm" disabled={!p.email} onPress={() => Linking.openURL(`mailto:${p.email}`)} />
              <Button icon="globe" label="Website" variant="outline" size="sm" disabled={!p.website} onPress={() => Linking.openURL(p.website!.startsWith("http") ? p.website! : `https://${p.website}`)} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sub}>
              Details are hidden until you reveal them.
              {p.hasPhone ? " A phone number is on file." : ""}
              {p.hasEmail ? " An email address is on file." : ""}
            </Text>
            {p.suppressed ? <Text style={styles.error}>This business is on your do-not-contact list.</Text> : null}
            {canReveal ? (
              confirmReveal ? (
                <View style={styles.row}>
                  <Button label={`Spend ${cost ?? "?"} credit(s)`} onPress={doReveal} loading={reveal.isPending} />
                  <Button label="Cancel" variant="ghost" onPress={() => setConfirmReveal(false)} />
                </View>
              ) : (
                <Button icon="unlock" label={cost != null ? `Reveal contact (${cost} credits)` : "Reveal contact"} onPress={() => setConfirmReveal(true)} />
              )
            ) : null}
          </>
        )}
      </SectionCard>

      {canImport ? (
        <SectionCard title="CRM">
          <Button icon="user-plus" label={importCrm.isPending ? "Adding…" : "Add to CRM as a lead"} onPress={doImport} disabled={importCrm.isPending} />
        </SectionCard>
      ) : p.crmLeadId ? (
        <SectionCard title="CRM"><Text style={styles.sub}>This business is already a CRM lead.</Text></SectionCard>
      ) : null}

      {canEdit ? (
        <SectionCard title="Status">
          <View style={styles.row}>
            {MANUAL_STATUSES.map((s: ProspectStatus) => (
              <Chip key={s} label={lgLabel(s)} active={p.status === s} onPress={() => p.status !== s && update.mutate({ id, status: s })} />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {p.scoreNotes.length > 0 ? (
        <SectionCard title="Why this score">
          {p.scoreNotes.map((n, i) => <Text key={i} style={styles.sub}>• {n}</Text>)}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.base, color: colors.mutedForeground },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    result: { fontSize: fontSize.base, color: colors.success },
    error: { fontSize: fontSize.base, color: colors.destructive },
  });
}
