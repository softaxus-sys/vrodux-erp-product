import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCreateGrn, usePurchaseOrder } from "@/hooks/use-purchase";
import { inventoryApi } from "@/lib/inventory.api";
import { LiveBarcodeScanner } from "@/components/scanner/LiveBarcodeScanner";
import type { CreateGrnItemRequest, PurchaseOrderItemDto } from "@/types/purchase";
import type { PurchaseStackParamList } from "@/navigation/types";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<PurchaseStackParamList, "ReceiveOrder">;

const TODAY = new Date().toISOString().split("T")[0];

/**
 * Scan-to-receive: a phone camera standing in for a warehouse barcode gun while unpacking a
 * delivery against an open PO. Each scan resolves via the same cross-schema barcode lookup
 * Inventory's own scanner uses (inventoryApi.getProductByBarcode -- unlike POS's own barcode
 * endpoint, this one sees products created in either pos.products or inventory.products), then
 * matches the resolved product against this order's own line items by productId.
 *
 * Submits a real Goods Receipt Note (POST /api/purchase/grn) -- the same endpoint and field names
 * the web app's create-grn-form.tsx uses. Matches that form's own simplification of starting every
 * line's "already received" at 0 rather than summing prior GRNs for this PO -- not a mobile-
 * specific gap.
 */
export default function ReceiveOrderScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { orderId, orderNumber } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: `Receive ${orderNumber}` });
  }, [navigation, orderNumber]);

  const order = usePurchaseOrder(orderId);
  const createGrn = useCreateGrn();

  const [received, setReceived] = useState<Map<string, number>>(new Map());
  const [busyLookup, setBusyLookup] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (messageTimer.current) clearTimeout(messageTimer.current); }, []);

  function flash(tone: "ok" | "error", text: string) {
    setMessage({ tone, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2200);
  }

  const adjust = useCallback((itemId: string, delta: number) => {
    setReceived((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) next.delete(itemId);
      else next.set(itemId, updated);
      return next;
    });
  }, []);

  const handleScan = useCallback(
    async (code: string) => {
      if (busyLookup || !order.data) return;
      setBusyLookup(true);
      try {
        const product = await inventoryApi.getProductByBarcode(code);
        const line = order.data.items.find((i) => i.productId === product.id);
        if (!line) {
          flash("error", `"${product.name}" isn't on this order.`);
          return;
        }
        adjust(line.id, 1);
        flash("ok", `+1 ${product.name}`);
      } catch {
        flash("error", `No product found for that barcode.`);
      } finally {
        setBusyLookup(false);
      }
    },
    [busyLookup, order.data, adjust],
  );

  if (order.isLoading || !order.data) return <LoadingState />;
  if (order.isError) return <ErrorState message="Couldn't load this order." onRetry={() => order.refetch()} />;

  const o = order.data;
  const anyReceived = received.size > 0;

  function handleSubmit() {
    const items: CreateGrnItemRequest[] = o.items
      .filter((i) => (received.get(i.id) ?? 0) > 0)
      .map((i) => ({
        purchaseOrderItemId: i.id,
        productId: i.productId ?? null,
        description: i.description,
        orderedQuantity: i.quantity,
        receivedQuantity: received.get(i.id)!,
        unitCost: i.unitCost,
      }));
    createGrn.mutate(
      { purchaseOrderId: o.id, grnDate: TODAY, driverName: null, notes: null, items },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.cameraBox}>
        <LiveBarcodeScanner onScan={handleScan} paused={busyLookup} hintText="Scan a product to receive it" />
        {message ? (
          <View style={[styles.messageBanner, message.tone === "error" ? styles.messageError : styles.messageOk]}>
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
        {o.items.map((item) => (
          <ReceiveLineRow key={item.id} item={item} received={received.get(item.id) ?? 0} onAdjust={(d) => adjust(item.id, d)} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {createGrn.isError ? <Text style={styles.errorText}>Couldn&apos;t submit this receipt.</Text> : null}
        <Button
          label={createGrn.isPending ? "Submitting…" : "Submit Receipt"}
          icon="check"
          disabled={!anyReceived || createGrn.isPending}
          loading={createGrn.isPending}
          onPress={handleSubmit}
          fullWidth
        />
      </View>
    </View>
  );
}

function ReceiveLineRow({ item, received, onAdjust }: { item: PurchaseOrderItemDto; received: number; onAdjust: (delta: number) => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowDescription} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.rowMeta}>Ordered {item.quantity}{item.productId ? "" : " · no barcode on file, use manual entry"}</Text>
      </View>
      <View style={styles.stepper}>
        <StepperButton icon="minus" onPress={() => onAdjust(-1)} disabled={received === 0} />
        <Text style={[styles.count, received > 0 && styles.countActive]}>{received}</Text>
        <StepperButton icon="plus" onPress={() => onAdjust(1)} />
      </View>
    </View>
  );
}

function StepperButton({ icon, onPress, disabled }: { icon: "plus" | "minus"; onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Button label="" icon={icon} variant="outline" size="sm" onPress={onPress} disabled={disabled} style={styles.stepperButton} />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },

    cameraBox: { height: 220, backgroundColor: "#000" },
    messageBanner: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
    messageOk: { backgroundColor: colors.success },
    messageError: { backgroundColor: colors.destructive },
    messageText: { color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: "center" },

    list: { padding: spacing.lg, gap: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    rowBody: { flex: 1, gap: 2 },
    rowDescription: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    rowMeta: { fontSize: fontSize.xs, color: colors.mutedForeground },

    stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stepperButton: { width: 32, height: 32, paddingHorizontal: 0 },
    count: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.mutedForeground, minWidth: 24, textAlign: "center" },
    countActive: { color: colors.primary },

    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, gap: spacing.sm },
    errorText: { color: colors.destructive, fontSize: fontSize.sm, textAlign: "center" },
  });
}
