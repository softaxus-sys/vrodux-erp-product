import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { inventoryApi } from "@/lib/inventory.api";
import { INVENTORY_PRODUCTS_CREATE } from "@/lib/inventory-write.api";
import { ApiError } from "@/lib/api-client";
import { useCreateMovement } from "@/hooks/use-inventory-write";
import { useWarehouses } from "@/hooks/use-inventory";
import { hasPermission } from "@/store/auth.store";
import type { ProductLookupDto } from "@/types/inventory";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "BarcodeScanner">;

/** The barcode formats actually used on retail/warehouse product labels -- QR is included since
 *  some tenants print a QR encoding the SKU (or a web link holding the barcode) rather than a 1D barcode. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] as const;

const CAN_RECEIVE = ["inventory.movements.create"];

/**
 * Scan a label, then act on it: add stock to something you already hold, or create the product with its
 * details pre-filled from the public product databases. Replaces the old "find or error" scanner, whose
 * dead end on an unknown code is what made adding new stock impossible from here.
 */
export default function BarcodeScannerScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [result, setResult] = useState<ProductLookupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  // The camera fires many frames for one label; only the first is acted on until the panel is dismissed.
  const busy = useRef(false);

  const canReceive = hasPermission(...CAN_RECEIVE);
  const canCreate = hasPermission(...INVENTORY_PRODUCTS_CREATE);
  const warehouses = useWarehouses(canReceive);
  const warehouse = (warehouses.data ?? []).filter((w) => w.isActive).find((w) => w.isDefault) ?? (warehouses.data ?? [])[0];
  const addStock = useCreateMovement();

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const dismiss = useCallback(() => {
    busy.current = false;
    setResult(null);
    setError(null);
    setQty("1");
    setManualCode("");
  }, []);

  const lookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || busy.current) return;
    busy.current = true;
    setLookingUp(true);
    setError(null);
    try {
      const res = await inventoryApi.lookupCode(trimmed);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not look that code up. Check your connection and try again.");
      busy.current = false;
    } finally {
      setLookingUp(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(
    (r: BarcodeScanningResult) => {
      lookup(r.data);
    },
    [lookup],
  );

  const existing = result?.existing ?? null;
  const quantity = Number(qty.replace(",", "."));
  const qtyOk = Number.isFinite(quantity) && quantity > 0;

  function receive() {
    if (!existing || !qtyOk) return;
    addStock.mutate(
      {
        productId: existing.id,
        movementType: "Receipt",
        quantity,
        unitCost: existing.costPrice,
        warehouseId: warehouse?.id ?? null,
        reference: null,
        notes: "Received by scanning",
      },
      {
        onSuccess: () => {
          setNotice(`Added ${quantity} to ${existing.name}`);
          dismiss();
        },
      },
    );
  }

  function createProduct() {
    if (!result) return;
    const s = result.suggested;
    navigation.replace("NewProduct", {
      barcode: result.code,
      name: s?.name,
      description: s?.description ?? undefined,
      brand: s?.brand ?? undefined,
      source: s?.sourceLabel,
    });
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  const manualBlock = (
    <ManualEntryBlock value={manualCode} onChangeText={setManualCode} onSubmit={() => lookup(manualCode)} busy={lookingUp} error={error} />
  );

  const panel = result ? (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.panelWrap}>
      <View style={styles.panel}>
        {existing ? (
          <>
            <View style={styles.row}>
              {existing.imageUrl ? <Image source={{ uri: existing.imageUrl }} style={styles.thumb} /> : null}
              <View style={styles.flex}>
                <Text style={styles.panelTitle} numberOfLines={2}>{existing.name}</Text>
                <Text style={styles.panelMeta}>
                  {[existing.sku, `${existing.stockQuantity} ${existing.unit} in stock`].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
            {canReceive ? (
              <>
                <Text style={styles.label}>Quantity received{warehouse ? ` · ${warehouse.name}` : ""}</Text>
                <TextInput
                  style={styles.input}
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  autoFocus
                  onSubmitEditing={receive}
                />
                {addStock.error ? <Text style={styles.errorText}>{addStock.error instanceof ApiError ? addStock.error.message : "Could not add the stock."}</Text> : null}
                <Button label={addStock.isPending ? "Adding…" : "Add stock"} disabled={!qtyOk || addStock.isPending} onPress={receive} />
              </>
            ) : (
              <Text style={styles.panelMeta}>You don&apos;t have permission to change stock.</Text>
            )}
            <Button
              label="View product"
              variant="outline"
              onPress={() => navigation.replace("ProductDetail", { productId: existing.id, productName: existing.name })}
            />
            <Button label="Scan another" variant="ghost" onPress={dismiss} />
          </>
        ) : (
          <>
            {result.suggested ? (
              <>
                <Text style={styles.panelMeta}>Not in your stock yet. Found in {result.suggested.sourceLabel}. You can check and change everything before saving.</Text>
                <View style={styles.row}>
                  {result.suggested.imageUrl ? <Image source={{ uri: result.suggested.imageUrl }} style={styles.thumb} /> : null}
                  <View style={styles.flex}>
                    <Text style={styles.panelTitle} numberOfLines={2}>{result.suggested.name}</Text>
                    <Text style={styles.panelMeta}>{[result.suggested.brand, result.suggested.quantity].filter(Boolean).join(" · ") || result.code}</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.panelMeta}>
                Nothing matches {result.code}, in your stock or in the product databases.{canCreate ? " You can still create it by hand." : ""}
              </Text>
            )}
            {canCreate ? (
              <Button label="Create product" onPress={createProduct} />
            ) : (
              <Text style={styles.panelMeta}>You don&apos;t have permission to create products.</Text>
            )}
            <Button label="Scan another" variant="ghost" onPress={dismiss} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  ) : null;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          {permission.canAskAgain
            ? "Vrodux ERP needs the camera to scan a product's barcode."
            : "Camera access was denied. Enable it for Vrodux ERP in your device Settings, or enter the barcode manually below."}
        </Text>
        {permission.canAskAgain ? <Button label="Grant Camera Access" onPress={requestPermission} /> : null}
        {manualBlock}
        {panel}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {manualEntry ? (
        <View style={styles.manualContainer}>
          {manualBlock}
          <Button label="Use camera instead" variant="ghost" onPress={() => { setManualEntry(false); dismiss(); }} />
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={result || lookingUp ? undefined : handleBarcodeScanned}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.frame} />
            <Text style={styles.hint}>{lookingUp ? "Looking up product…" : "Line up the barcode or QR code inside the frame"}</Text>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
            {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
            {!result ? <Button label="Enter barcode manually" variant="outline" onPress={() => setManualEntry(true)} style={styles.manualButton} /> : null}
          </View>
        </>
      )}
      {panel}
    </View>
  );
}

function ManualEntryBlock({
  value,
  onChangeText,
  onSubmit,
  busy,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.manualBlock}>
      <Text style={styles.label}>Barcode</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Type or paste a barcode…"
        placeholderTextColor={colors.subtleForeground}
        autoCapitalize="none"
        autoFocus
        onSubmitEditing={onSubmit}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button label={busy ? "Looking up…" : "Look Up"} disabled={busy || value.trim().length === 0} onPress={onSubmit} />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    flex: { flex: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },

    overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.lg },
    frame: { width: 240, height: 150, borderWidth: 3, borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: "transparent" },
    hint: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.medium, textAlign: "center" },
    errorBanner: { color: colors.destructive, backgroundColor: "#fff", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, fontSize: fontSize.sm, textAlign: "center" },
    noticeBanner: { color: "#065f46", backgroundColor: "#d1fae5", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, fontSize: fontSize.sm, textAlign: "center" },
    manualButton: { position: "absolute", bottom: spacing.xxl },

    panelWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
    panel: { gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    panelTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground },
    panelMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.card },

    manualContainer: { flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background },
    manualBlock: { gap: spacing.sm },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card },
    errorText: { fontSize: fontSize.sm, color: colors.destructive },

    permissionContainer: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
    permissionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, textAlign: "center" },
    permissionBody: { fontSize: fontSize.base, color: colors.mutedForeground, textAlign: "center" },
  });
}
