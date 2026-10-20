import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, SearchInput } from "@/components/ui";
import { useCustomerSearch } from "@/hooks/use-restaurant";
import type { CustomerLiteDto } from "@/types/restaurant";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

export function CustomerPickerModal({
  visible,
  currentCustomerId,
  busy,
  errorMessage,
  onSelect,
  onUnlink,
  onCancel,
}: {
  visible: boolean;
  currentCustomerId: string | null;
  busy: boolean;
  errorMessage?: string | null;
  onSelect: (customer: CustomerLiteDto) => void;
  onUnlink: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [search, setSearch] = useState("");
  const results = useCustomerSearch(search);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Link a Customer</Text>
          <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or phone…" />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.listWrap}>
            {search.trim().length < 2 ? (
              <Text style={styles.hint}>Type at least 2 characters to search.</Text>
            ) : results.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            ) : results.isError ? (
              <Text style={styles.error}>Couldn't search customers.</Text>
            ) : (results.data?.items ?? []).length === 0 ? (
              <Text style={styles.hint}>No customers match that search.</Text>
            ) : (
              <FlatList
                data={results.data!.items}
                keyExtractor={(c) => c.id}
                style={styles.list}
                renderItem={({ item }) => (
                  <Pressable style={styles.row} disabled={busy} onPress={() => onSelect(item)}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowMeta}>
                        {item.phone ?? "—"} · {item.loyaltyPoints.toFixed(0)} pts
                      </Text>
                    </View>
                    {item.id === currentCustomerId ? <Text style={styles.linkedTag}>Linked</Text> : null}
                  </Pressable>
                )}
              />
            )}
          </View>

          <View style={styles.actions}>
            {currentCustomerId ? <Button label="Unlink" variant="outline" disabled={busy} onPress={onUnlink} /> : null}
            <Button label="Close" variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, maxHeight: "80%" },
    title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    listWrap: { minHeight: 80 },
    list: { maxHeight: 280 },
    spinner: { marginTop: spacing.lg },
    hint: { fontSize: fontSize.sm, color: colors.mutedForeground, marginTop: spacing.sm },
    error: { fontSize: fontSize.sm, color: colors.destructive },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowBody: { flex: 1 },
    rowName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    rowMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    linkedTag: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  });
}
