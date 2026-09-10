import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVendor } from "@/hooks/use-purchase";
import { cleanPhone } from "@/lib/crm-helpers";
import type { PurchaseStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<PurchaseStackParamList, "VendorDetail">;

export default function VendorDetailScreen({ route, navigation }: Props) {
  const { vendorId, vendorName } = route.params;
  navigation.setOptions({ headerTitle: vendorName });

  const vendor = useVendor(vendorId);

  if (vendor.isLoading || !vendor.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (vendor.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load this vendor.</Text>
        <Pressable onPress={() => vendor.refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const v = vendor.data;
  const phone = cleanPhone(v.phone);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{v.name}</Text>
        <Text style={styles.subtitle}>
          {[v.category, v.status].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Rating" value={v.rating > 0 ? `★ ${v.rating.toFixed(1)}` : "—"} />
          <Stat label="Orders" value={String(v.purchaseOrderCount)} />
          <Stat label="Payment terms" value={v.paymentTerms || "—"} />
          <Stat label="Currency" value={v.currency} />
        </View>
      </View>

      <Section title="Contact">
        <View style={styles.actionsRow}>
          <ActionButton label="Call" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} />
          <ActionButton label="Email" disabled={!v.email} onPress={() => Linking.openURL(`mailto:${v.email}`)} />
        </View>
        {v.contactPerson ? <Detail label="Contact person" value={v.contactPerson} /> : null}
        {v.address ? <Detail label="Address" value={v.address} /> : null}
        {v.taxNumber ? <Detail label="Tax number" value={v.taxNumber} /> : null}
      </Section>

      {v.notes ? (
        <Section title="Notes">
          <Text style={styles.bodyText}>{v.notes}</Text>
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.actionButton, disabled && styles.actionButtonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { color: "#dc2626" },
  retry: { color: "#2563eb", fontWeight: "600" },

  header: { gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", textTransform: "capitalize" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 8 },
  stat: {},
  statLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  section: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  bodyText: { fontSize: 14, color: "#111827" },

  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, backgroundColor: "#111827", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  actionButtonDisabled: { backgroundColor: "#e5e7eb" },
  actionButtonText: { color: "#fff", fontWeight: "600" },
  actionButtonTextDisabled: { color: "#9ca3af" },

  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: "#6b7280" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right" },
});
