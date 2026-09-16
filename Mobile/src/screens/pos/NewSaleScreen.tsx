import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCreateSale, usePaymentMethods } from "@/hooks/use-pos";
import { inventoryApi } from "@/lib/inventory.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { LiveBarcodeScanner } from "@/components/scanner/LiveBarcodeScanner";
import { useAuthStore } from "@/store/auth.store";
import type { CartLine, POSTransactionDto } from "@/types/pos";
import type { POSStackParamList } from "@/navigation/types";
import { Badge, Button, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

type Props = NativeStackScreenProps<POSStackParamList, "NewSale">;
type Mode = "scan" | "cart" | "checkout" | "complete";

/**
 * Camera-as-scanner checkout: scan a product's barcode with the phone's own camera to add it to
 * the cart (the same cross-schema lookup Inventory's scanner uses), review/adjust quantities, pick
 * a payment method, and record the sale. Single payment method per sale for this pass (confirmed
 * scope) -- see Mobile/README.md's "POS Checkout" section for what's deliberately deferred
 * (split-tender, discounts, printed receipts, hold/recall, void/refund).
 */
export default function NewSaleScreen({ route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sessionId } = route.params;
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const [mode, setMode] = useState<Mode>("scan");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busyLookup, setBusyLookup] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<POSTransactionDto | null>(null);

  const paymentMethods = usePaymentMethods();
  const createSale = useCreateSale();

  function flash(tone: "ok" | "error", text: string) {
    setScanMessage({ tone, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setScanMessage(null), 2000);
  }

  const addToCart = useCallback((line: CartLine) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === line.productId);
      if (existing) {
        return prev.map((l) => (l.productId === line.productId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, line];
    });
  }, []);

  const handleScan = useCallback(
    async (code: string) => {
      if (busyLookup) return;
      setBusyLookup(true);
      try {
        const product = await inventoryApi.getProductByBarcode(code);
        addToCart({ productId: product.id, name: product.name, unitPrice: product.salePrice, quantity: 1 });
        flash("ok", `Added ${product.name}`);
      } catch {
        flash("error", "No product found for that barcode.");
      } finally {
        setBusyLookup(false);
      }
    },
    [busyLookup, addToCart],
  );

  function adjustQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function startCheckout() {
    setMode("checkout");
    const firstEnabled = (paymentMethods.data ?? []).find((m) => m.isEnabled);
    if (firstEnabled) setPaymentMethod(firstEnabled.code);
  }

  function submitSale() {
    if (!paymentMethod || cart.length === 0) return;
    createSale.mutate(
      {
        sessionId,
        lineItems: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        payments: [{ method: paymentMethod, amount: total }],
      },
      {
        onSuccess: (sale) => {
          setCompletedSale(sale);
          setMode("complete");
        },
      },
    );
  }

  function startNewSale() {
    setCart([]);
    setPaymentMethod(null);
    setCompletedSale(null);
    setMode("scan");
  }

  async function shareReceipt() {
    if (!completedSale) return;
    const lines = completedSale.lineItems
      .map((li) => `${li.quantity} x ${li.productName} — ${formatCompactValue(li.lineTotal, currency)}`)
      .join("\n");
    const message =
      `Sale ${completedSale.transactionNumber}\n\n${lines}\n\n` +
      `Total: ${formatCompactValue(completedSale.totalAmount, currency)}\n` +
      `Paid via ${completedSale.payments[0]?.method ?? paymentMethod ?? ""}`;
    try {
      await Share.share({ message });
    } catch {
      // Sharing being dismissed/unavailable is never an error worth surfacing.
    }
  }

  // ── Complete ────────────────────────────────────────────────────────────
  if (mode === "complete" && completedSale) {
    return (
      <ScrollView contentContainerStyle={styles.completeContainer}>
        <View style={styles.completeIcon}>
          <Feather name="check" size={28} color={colors.onPrimary} />
        </View>
        <Text style={styles.completeTitle}>Sale complete</Text>
        <Text style={styles.completeNumber}>{completedSale.transactionNumber}</Text>
        <View style={styles.completeCard}>
          {completedSale.lineItems.map((li) => (
            <View key={li.id} style={styles.completeLine}>
              <Text style={styles.completeLineText}>{li.quantity} × {li.productName}</Text>
              <Text style={styles.completeLineValue}>{formatCompactValue(li.lineTotal, currency)}</Text>
            </View>
          ))}
          <View style={[styles.completeLine, styles.completeTotalRow]}>
            <Text style={styles.completeTotalLabel}>Total</Text>
            <Text style={styles.completeTotalValue}>{formatCompactValue(completedSale.totalAmount, currency)}</Text>
          </View>
        </View>
        <Button label="Share Receipt" icon="share" variant="outline" onPress={shareReceipt} fullWidth />
        <Button label="Start New Sale" icon="shopping-cart" onPress={startNewSale} fullWidth />
      </ScrollView>
    );
  }

  // ── Checkout ────────────────────────────────────────────────────────────
  if (mode === "checkout") {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.checkoutContainer}>
          <Text style={styles.checkoutTotal}>{formatCompactValue(total, currency)}</Text>
          <Text style={styles.checkoutSubtitle}>{itemCount} item{itemCount === 1 ? "" : "s"}</Text>

          <Text style={styles.sectionLabel}>Payment method</Text>
          {paymentMethods.isLoading ? (
            <LoadingState size="small" />
          ) : paymentMethods.isError ? (
            <ErrorState message="Couldn't load payment methods." onRetry={() => paymentMethods.refetch()} />
          ) : (paymentMethods.data ?? []).filter((m) => m.isEnabled).length === 0 ? (
            <Text style={styles.emptyText}>No payment methods are configured for this tenant yet.</Text>
          ) : (
            <View style={styles.methodList}>
              {(paymentMethods.data ?? [])
                .filter((m) => m.isEnabled)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((m) => (
                  <Pressable
                    key={m.id}
                    style={[styles.methodRow, paymentMethod === m.code && styles.methodRowActive]}
                    onPress={() => setPaymentMethod(m.code)}
                  >
                    <Text style={[styles.methodLabel, paymentMethod === m.code && styles.methodLabelActive]}>{m.label}</Text>
                    {paymentMethod === m.code ? <Feather name="check-circle" size={18} color={colors.primary} /> : null}
                  </Pressable>
                ))}
            </View>
          )}

          {createSale.isError ? (
            <Text style={styles.errorText}>
              {createSale.error instanceof Error ? createSale.error.message : "Couldn't record this sale."}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Back to cart" variant="ghost" onPress={() => setMode("cart")} />
          <Button
            label={createSale.isPending ? "Charging…" : `Charge ${formatCompactValue(total, currency)}`}
            icon="check"
            disabled={!paymentMethod || createSale.isPending}
            loading={createSale.isPending}
            onPress={submitSale}
            fullWidth
          />
        </View>
      </View>
    );
  }

  // ── Cart review ─────────────────────────────────────────────────────────
  if (mode === "cart") {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.list}>
          {cart.length === 0 ? (
            <Text style={styles.emptyText}>Cart is empty -- scan a product to add it.</Text>
          ) : (
            cart.map((line) => (
              <View key={line.productId} style={styles.cartRow}>
                <View style={styles.cartRowBody}>
                  <Text style={styles.cartRowName} numberOfLines={2}>{line.name}</Text>
                  <Text style={styles.cartRowMeta}>{formatCompactValue(line.unitPrice, currency)} each</Text>
                </View>
                <View style={styles.stepper}>
                  <StepperButton icon="minus" onPress={() => adjustQty(line.productId, -1)} />
                  <Text style={styles.count}>{line.quantity}</Text>
                  <StepperButton icon="plus" onPress={() => adjustQty(line.productId, 1)} />
                </View>
                <Pressable onPress={() => removeLine(line.productId)} hitSlop={8} style={styles.removeButton}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Total</Text>
            <Text style={styles.cartTotalValue}>{formatCompactValue(total, currency)}</Text>
          </View>
          <Button label="Scan more" variant="outline" icon="camera" onPress={() => setMode("scan")} fullWidth />
          <Button label="Checkout" icon="arrow-right" disabled={cart.length === 0} onPress={startCheckout} fullWidth />
        </View>
      </View>
    );
  }

  // ── Scanning (default) ────────────────────────────────────────────────
  return (
    <View style={styles.flex}>
      <View style={styles.cameraBox}>
        <LiveBarcodeScanner onScan={handleScan} paused={busyLookup} hintText="Scan a product to add it to the sale" />
        {scanMessage ? (
          <View style={[styles.messageBanner, scanMessage.tone === "error" ? styles.messageError : styles.messageOk]}>
            <Text style={styles.messageText}>{scanMessage.text}</Text>
          </View>
        ) : null}
      </View>
      <Pressable style={styles.cartStrip} onPress={() => setMode("cart")} disabled={cart.length === 0}>
        <View style={styles.cartStripLeft}>
          <Feather name="shopping-cart" size={18} color={colors.foreground} />
          <Text style={styles.cartStripText}>{itemCount} item{itemCount === 1 ? "" : "s"}</Text>
          {cart.length > 0 ? <Badge label="Review" tone="info" dot={false} /> : null}
        </View>
        <Text style={styles.cartStripTotal}>{formatCompactValue(total, currency)}</Text>
      </Pressable>
    </View>
  );
}

function StepperButton({ icon, onPress }: { icon: "plus" | "minus"; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Button label="" icon={icon} variant="outline" size="sm" onPress={onPress} style={styles.stepperButton} />;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },

    cameraBox: { flex: 1, backgroundColor: "#000" },
    messageBanner: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
    messageOk: { backgroundColor: colors.success },
    messageError: { backgroundColor: colors.destructive },
    messageText: { color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: "center" },

    cartStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cartStripLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cartStripText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    cartStripTotal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },

    list: { padding: spacing.lg, gap: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.subtleForeground, textAlign: "center", paddingVertical: spacing.xl },

    cartRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    cartRowBody: { flex: 1, gap: 2 },
    cartRowName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
    cartRowMeta: { fontSize: fontSize.xs, color: colors.mutedForeground },
    removeButton: { padding: spacing.xs },

    stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stepperButton: { width: 32, height: 32, paddingHorizontal: 0 },
    count: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground, minWidth: 20, textAlign: "center" },

    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, gap: spacing.sm },
    cartTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
    cartTotalLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    cartTotalValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },

    checkoutContainer: { padding: spacing.lg, gap: spacing.md, alignItems: "center" },
    checkoutTotal: { fontSize: fontSize.xxxl, fontWeight: fontWeight.bold, color: colors.foreground },
    checkoutSubtitle: { fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.md },
    sectionLabel: { alignSelf: "flex-start", fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },
    errorText: { color: colors.destructive, fontSize: fontSize.sm, textAlign: "center" },

    methodList: { width: "100%", gap: spacing.sm },
    methodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    methodRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    methodLabel: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },
    methodLabelActive: { color: colors.primary, fontWeight: fontWeight.semibold },

    completeContainer: { padding: spacing.xl, gap: spacing.md, alignItems: "center" },
    completeIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    completeTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    completeNumber: { fontSize: fontSize.sm, color: colors.mutedForeground, marginBottom: spacing.sm },
    completeCard: { width: "100%", backgroundColor: colors.cardMuted, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.md },
    completeLine: { flexDirection: "row", justifyContent: "space-between" },
    completeLineText: { fontSize: fontSize.sm, color: colors.foreground, flex: 1 },
    completeLineValue: { fontSize: fontSize.sm, color: colors.mutedForeground },
    completeTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs, marginTop: spacing.xs },
    completeTotalLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.foreground },
    completeTotalValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
  });
}
