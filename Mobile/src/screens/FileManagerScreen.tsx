import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useDocumentLibrary } from "@/hooks/use-file-manager";
import { CRM_CUSTOMERS_VIEW, CRM_LEADS_VIEW, CRM_PIPELINE_VIEW } from "@/lib/crm.api";
import { hasModuleAccess, hasPermission, useAuthStore } from "@/store/auth.store";
import { RELATED_TO_LABELS, documentTypeLabel, formatFileSize } from "@/types/file-manager";
import type { CrmDocumentDto, CrmDocumentTarget } from "@/types/file-manager";
import { Chip, EmptyState, ErrorState, ListItemCard, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

const RELATED_TYPE_FILTERS: { key: "all" | CrmDocumentTarget; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lead", label: "Leads" },
  { key: "deal", label: "Opportunities" },
  { key: "customer", label: "Accounts" },
  { key: "contact", label: "Contacts" },
];

/** Read-only browse -- see the top-of-file note below the imports for why there's no
 *  download/preview yet, and why there's no upload at all. */
export default function FileManagerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myName = useAuthStore((s) => s.user?.fullName ?? "");
  const [search, setSearch] = useState("");
  const [relatedToType, setRelatedToType] = useState<"all" | CrmDocumentTarget>("all");
  const [documentType, setDocumentType] = useState("all");

  const canReadCrmDocs =
    hasModuleAccess("crm") && hasPermission(...CRM_LEADS_VIEW, ...CRM_PIPELINE_VIEW, ...CRM_CUSTOMERS_VIEW);

  const library = useDocumentLibrary(
    {
      search: search.trim() || undefined,
      relatedToType: relatedToType === "all" ? undefined : relatedToType,
      documentType: documentType === "all" ? undefined : documentType,
    },
    canReadCrmDocs,
  );

  const docs = library.data ?? [];
  const typeFilters = useMemo(() => {
    const present = new Set(docs.map((d) => d.documentType));
    return ["all", ...Array.from(present).sort()];
  }, [docs]);

  const groups = useMemo(() => {
    if (search.trim()) return null; // searching flattens the tree -- folder context isn't useful mid-search
    const byOwner = new Map<string, CrmDocumentDto[]>();
    for (const d of docs) {
      const key = d.ownerName ?? "Unassigned";
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key)!.push(d);
    }
    return Array.from(byOwner.entries()).sort(([a], [b]) => {
      if (a === myName) return -1;
      if (b === myName) return 1;
      return byOwner.get(b)!.length - byOwner.get(a)!.length;
    });
  }, [docs, search, myName]);

  if (!canReadCrmDocs) {
    return (
      <View style={styles.centered}>
        <EmptyState icon="folder" title="No document libraries available" subtitle="There are no document libraries available to you yet." />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={library.isRefetching} onRefresh={() => library.refetch()} tintColor={colors.primary} />}
    >
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by file name…" />

      <View style={styles.filterRow}>
        {RELATED_TYPE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={relatedToType === f.key} onPress={() => setRelatedToType(f.key)} />
        ))}
      </View>
      {typeFilters.length > 1 ? (
        <View style={styles.filterRow}>
          {typeFilters.map((t) => (
            <Chip key={t} label={t === "all" ? "All types" : documentTypeLabel(t)} active={documentType === t} onPress={() => setDocumentType(t)} />
          ))}
        </View>
      ) : null}

      {library.isError ? (
        <ErrorState message="Couldn't load documents." onRetry={() => library.refetch()} />
      ) : library.isLoading ? (
        <LoadingState />
      ) : docs.length === 0 ? (
        <EmptyState icon="file" title="No documents here" />
      ) : groups ? (
        groups.map(([owner, items]) => (
          <View key={owner} style={styles.folder}>
            <View style={styles.folderHeader}>
              <Feather name="folder" size={16} color={colors.mutedForeground} />
              <Text style={styles.folderTitle}>
                {owner === myName ? "My documents" : owner} ({items.length})
              </Text>
            </View>
            {items.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </View>
        ))
      ) : (
        <View style={styles.folder}>
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function DocumentRow({ doc }: { doc: CrmDocumentDto }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ListItemCard>
      <View style={styles.rowTop}>
        <Feather name="file-text" size={16} color={colors.primary} style={styles.fileIcon} />
        <Text style={styles.fileName} numberOfLines={1}>
          {doc.fileName}
        </Text>
      </View>
      <Text style={styles.meta}>
        {documentTypeLabel(doc.documentType)} · {formatFileSize(doc.sizeBytes)}
      </Text>
      <Text style={styles.meta}>
        {RELATED_TO_LABELS[doc.relatedToType]}: {doc.relatedToName ?? "—"}
      </Text>
      <Text style={styles.subtleMeta}>
        {doc.uploadedByName ? `Uploaded by ${doc.uploadedByName} · ` : ""}
        {doc.createdAt}
      </Text>
    </ListItemCard>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { paddingBottom: spacing.xl },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },

    folder: { marginBottom: spacing.md },
    folderHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
    folderTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.3 },

    rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    fileIcon: { marginTop: 1 },
    fileName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    meta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    subtleMeta: { fontSize: fontSize.xs, color: colors.subtleForeground, marginTop: 2 },
  });
}
