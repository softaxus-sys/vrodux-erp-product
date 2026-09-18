import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePostJournalEntry, useVoidJournalEntry } from "@/hooks/use-finance-ledger";
import { formatCompactValue } from "@/lib/crm-helpers";
import { useAuthStore } from "@/store/auth.store";
import { JOURNAL_STATUS_LABELS, JOURNAL_STATUS_TONE } from "@/types/finance-ledger";
import type { FinanceStackParamList } from "@/navigation/types";
import { Badge, Button, DetailRow, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<FinanceStackParamList, "JournalDetail">;

/** No `GET /journals/{id}` exists on the backend -- the list already embeds full lines[] per
 *  entry, so the whole row is passed through navigation params instead of a second fetch. */
export default function JournalDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const [journal, setJournal] = useState(route.params.journal);
  useEffect(() => {
    navigation.setOptions({ headerTitle: journal.journalNumber });
  }, [navigation, journal.journalNumber]);

  const post = usePostJournalEntry();
  const voidEntry = useVoidJournalEntry();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.number}>{journal.journalNumber}</Text>
          <Badge label={JOURNAL_STATUS_LABELS[journal.status]} tone={JOURNAL_STATUS_TONE[journal.status]} />
        </View>
        <Text style={styles.description}>{journal.description}</Text>
        <View style={styles.statsRow}>
          <Stat label="Debit" value={formatCompactValue(journal.totalDebit, currency)} tone="primary" />
          <Stat label="Credit" value={formatCompactValue(journal.totalCredit, currency)} />
        </View>
        {!journal.isBalanced ? <Badge label="Unbalanced entry" tone="destructive" /> : null}
      </View>

      <SectionCard title="Details">
        <DetailRow label="Date" value={journal.date} />
        <DetailRow label="Period" value={journal.period} />
        {journal.reference ? <DetailRow label="Reference" value={journal.reference} /> : null}
        <DetailRow label="Created by" value={journal.createdBy} />
        {journal.postedBy ? <DetailRow label="Posted by" value={journal.postedBy} /> : null}
        {journal.postedDate ? <DetailRow label="Posted on" value={journal.postedDate} /> : null}
      </SectionCard>

      <SectionCard title={`Lines (${journal.lines.length})`}>
        {journal.lines.map((line) => (
          <View key={line.id} style={styles.line}>
            <View style={styles.lineTop}>
              <Text style={styles.lineAccount} numberOfLines={1}>{line.accountCode} · {line.accountName}</Text>
            </View>
            {line.description ? <Text style={styles.lineDescription}>{line.description}</Text> : null}
            <View style={styles.lineAmounts}>
              <Text style={styles.lineAmountLabel}>Dr {formatCompactValue(line.debit, currency)}</Text>
              <Text style={styles.lineAmountLabel}>Cr {formatCompactValue(line.credit, currency)}</Text>
            </View>
          </View>
        ))}
      </SectionCard>

      {journal.status === "draft" ? (
        <View style={styles.actionsRow}>
          <Button
            label={post.isPending ? "..." : "Post entry"}
            icon="check"
            loading={post.isPending}
            onPress={() =>
              post.mutate(journal.id, { onSuccess: () => setJournal((j) => ({ ...j, status: "posted" })) })
            }
            fullWidth
          />
        </View>
      ) : journal.status === "posted" ? (
        <View style={styles.actionsRow}>
          <Button
            label={voidEntry.isPending ? "..." : "Void entry"}
            icon="x-circle"
            variant="destructive"
            loading={voidEntry.isPending}
            onPress={() =>
              voidEntry.mutate(journal.id, { onSuccess: () => setJournal((j) => ({ ...j, status: "voided" })) })
            }
            fullWidth
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.sm },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    number: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    description: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },

    line: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: spacing.sm, gap: 2 },
    lineTop: { flexDirection: "row", justifyContent: "space-between" },
    lineAccount: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    lineDescription: { fontSize: fontSize.sm, color: colors.mutedForeground },
    lineAmounts: { flexDirection: "row", gap: spacing.lg, marginTop: 2 },
    lineAmountLabel: { fontSize: fontSize.sm, color: colors.foregroundSecondary, fontWeight: fontWeight.medium },

    actionsRow: { marginTop: spacing.xs },
  });
}
