import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { inventoryApi } from "@/lib/inventory.api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { InventoryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<InventoryStackParamList, "BarcodeScanner">;

/** The barcode formats actually used on retail/warehouse product labels -- QR is included since
 *  some tenants print a QR encoding the SKU rather than a 1D barcode. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] as const;

export default function BarcodeScannerScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setScanning(false);
      setLookingUp(true);
      setError(null);
      try {
        const product = await inventoryApi.getProductByBarcode(trimmed);
        navigation.replace("ProductDetail", { productId: product.id, productName: product.name });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `No product found for barcode "${trimmed}".`);
        setLookingUp(false);
        // Stay in manual-entry mode after a failed manual lookup; re-arm the camera after a
        // failed scan so a mis-read (damaged label, wrong angle) doesn't need backing out.
        if (!manualEntry) setScanning(true);
      }
    },
    [manualEntry, navigation],
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scanning || lookingUp) return;
      lookup(result.data);
    },
    [scanning, lookingUp, lookup],
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

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
        <ManualEntryBlock value={manualCode} onChangeText={setManualCode} onSubmit={() => lookup(manualCode)} busy={lookingUp} error={error} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {manualEntry ? (
        <View style={styles.manualContainer}>
          <ManualEntryBlock value={manualCode} onChangeText={setManualCode} onSubmit={() => lookup(manualCode)} busy={lookingUp} error={error} />
          <Button label="Use camera instead" variant="ghost" onPress={() => setManualEntry(false)} />
        </View>
      ) : (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.frame} />
            <Text style={styles.hint}>{lookingUp ? "Looking up product…" : "Line up the barcode inside the frame"}</Text>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
            <Button label="Enter barcode manually" variant="outline" onPress={() => setManualEntry(true)} style={styles.manualButton} />
          </View>
        </>
      )}
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

    overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.lg },
    frame: { width: 240, height: 150, borderWidth: 3, borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: "transparent" },
    hint: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.medium, textAlign: "center" },
    errorBanner: { color: colors.destructive, backgroundColor: "#fff", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, fontSize: fontSize.sm, textAlign: "center" },
    manualButton: { position: "absolute", bottom: spacing.xxl },

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
