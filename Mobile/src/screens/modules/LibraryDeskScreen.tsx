import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { localToday } from "@/lib/module-browser";
import { hasPermission } from "@/store/auth.store";
import { LiveBarcodeScanner } from "@/components/scanner/LiveBarcodeScanner";
import { PickerField, errorMessage, type PickOption } from "@/components/forms/FormKit";
import { Badge, Button, SectionCard, DetailRow } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

interface Copy {
  id: string; title: string; authors: string; barcode: string; branchName: string; status: string;
  loanId: string | null; memberName: string | null; dueDate: string | null;
}
interface Member { id: string; fullName: string; memberNumber: string }

/** Scan a book: lend it if it is on the shelf, take it back if it is out. */
export default function LibraryDeskScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const qc = useQueryClient();
  const [copy, setCopy] = useState<Copy | null>(null);
  const [member, setMember] = useState<PickOption | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const canIssue = hasPermission("library.circulation.create");
  const canReturn = hasPermission("library.circulation.edit");

  const members = useQuery({
    queryKey: ["library-desk-members"],
    queryFn: () => apiClient.get<{ items: Member[] }>(`/api/library/members?today=${localToday()}&pageSize=200`),
    enabled: copy?.status === "available",
  });

  const scan = useCallback(async (code: string) => {
    setMessage(null);
    setLookupError(null);
    setMember(null);
    try {
      setCopy(await apiClient.get<Copy>(`/api/library/copies/by-barcode/${encodeURIComponent(code)}`));
    } catch (e) {
      setCopy(null);
      setLookupError(errorMessage(e) ?? "That barcode is not in the catalogue.");
    }
  }, []);

  const done = (text: string) => {
    setMessage(text);
    setCopy(null);
    setMember(null);
    qc.invalidateQueries({ queryKey: ["module-list"] });
    qc.invalidateQueries({ queryKey: ["module-summary"] });
  };

  const issue = useMutation({
    mutationFn: () => apiClient.post<{ dueDate: string }>("/api/library/loans", { memberId: member!.id, copyId: copy!.id, dueDate: null, today: localToday() }),
    onSuccess: (loan) => done(`Issued to ${member?.label}. Due ${String(loan.dueDate).slice(0, 10)}.`),
  });
  const ret = useMutation({
    mutationFn: () => apiClient.post<{ fineAmount: number; heldForMemberName: string | null }>(`/api/library/loans/${copy!.loanId}/return`, { returnBranchId: null, damaged: false, notes: null, today: localToday() }),
    onSuccess: (r) => done(`Returned.${r.fineAmount > 0 ? ` Late fine: ${r.fineAmount}.` : ""}${r.heldForMemberName ? ` Set aside for ${r.heldForMemberName}.` : ""}`),
  });

  const options: PickOption[] = (members.data?.items ?? []).map((m) => ({ id: m.id, label: m.fullName, sub: m.memberNumber }));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <LiveBarcodeScanner onScan={scan} paused={copy !== null} hintText="Scan the barcode inside the book" />
      {message ? <Text style={[styles.note, { color: colors.success }]}>{message}</Text> : null}
      {lookupError ? <Text style={[styles.note, { color: colors.destructive }]}>{lookupError}</Text> : null}

      {copy ? (
        <SectionCard title={copy.title}>
          <View style={styles.badgeRow}><Badge label={copy.status.replace(/_/g, " ")} tone={copy.status === "available" ? "success" : "warning"} /></View>
          <DetailRow label="Author" value={copy.authors || "—"} />
          <DetailRow label="Barcode" value={copy.barcode} />
          <DetailRow label="Branch" value={copy.branchName} />
          {copy.memberName ? <DetailRow label="Borrowed by" value={copy.memberName} /> : null}
          {copy.dueDate ? <DetailRow label="Due" value={copy.dueDate.slice(0, 10)} /> : null}

          {copy.status === "on_loan" && copy.loanId && canReturn ? (
            <Button label="Return this book" onPress={() => ret.mutate()} loading={ret.isPending} />
          ) : null}
          {copy.status === "available" && canIssue ? (
            <View style={styles.gap}>
              <PickerField label="Lend to" required value={member} onChange={setMember} options={options} loading={members.isLoading} allowClear={false} />
              <Button label="Issue book" onPress={() => issue.mutate()} disabled={!member} loading={issue.isPending} />
            </View>
          ) : null}
          {copy.status !== "available" && copy.status !== "on_loan" ? <Text style={styles.note}>This copy is {copy.status.replace(/_/g, " ")} and cannot be lent.</Text> : null}
          {issue.isError || ret.isError ? <Text style={[styles.note, { color: colors.destructive }]}>{errorMessage(issue.error ?? ret.error)}</Text> : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.mutedForeground },
    badgeRow: { alignSelf: "flex-start", marginBottom: spacing.sm },
    gap: { gap: spacing.md, marginTop: spacing.md },
  });
}
