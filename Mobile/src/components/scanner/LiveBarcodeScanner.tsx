import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

/** The barcode formats actually used on retail/warehouse product labels -- QR is included since
 *  some tenants print a QR encoding the SKU rather than a 1D barcode. Same list as Inventory's
 *  BarcodeScannerScreen.tsx, which this component was extracted from. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] as const;

/** The same physical barcode scanned again inside this window is suppressed -- long enough that
 *  a camera still pointed at a just-scanned label doesn't fire a second decode from the same
 *  glance, short enough that deliberately scanning the same item twice (to bump its cart quantity
 *  to 2) only needs the ordinary couple of seconds it takes to physically re-present the label. */
const REPEAT_SUPPRESS_MS = 1500;

interface LiveBarcodeScannerProps {
  /** Fired for every accepted decode (camera or manual entry) -- unlike Inventory's one-shot
   *  scanner, this component stays mounted and keeps scanning after firing. */
  onScan: (code: string) => void;
  /** Caller-controlled pause -- e.g. while a "not found" toast is showing, so the same misread
   *  isn't re-fired every frame while the message is still up. */
  paused?: boolean;
  /** Shown under the frame while the camera is live and idle. */
  hintText?: string;
}

/**
 * Reusable live camera scanner for flows that build up a list from many scans (a sale's cart, a
 * delivery's received quantities) -- as opposed to Inventory's BarcodeScannerScreen.tsx, which
 * looks up exactly one code then navigates away. Extracted from that screen's camera/permission/
 * manual-entry plumbing; BarcodeScannerScreen itself is left untouched.
 */
export function LiveBarcodeScanner({ onScan, paused = false, hintText }: LiveBarcodeScannerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const accept = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === code && now - last.at < REPEAT_SUPPRESS_MS) return;
      lastScanRef.current = { code, at: now };
      onScan(code);
    },
    [onScan],
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (paused) return;
      accept(result.data);
    },
    [paused, accept],
  );

  const submitManual = useCallback(() => {
    if (!manualCode.trim()) return;
    accept(manualCode);
    setManualCode("");
  }, [manualCode, accept]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          {permission.canAskAgain
            ? "Vrodux ERP needs the camera to scan barcodes."
            : "Camera access was denied. Enable it for Vrodux ERP in your device Settings, or enter barcodes manually below."}
        </Text>
        {permission.canAskAgain ? <Button label="Grant Camera Access" onPress={requestPermission} /> : null}
        <ManualEntryBlock value={manualCode} onChangeText={setManualCode} onSubmit={submitManual} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {manualEntry ? (
        <View style={styles.manualContainer}>
          <ManualEntryBlock value={manualCode} onChangeText={setManualCode} onSubmit={submitManual} />
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
            <Text style={styles.hint}>{hintText ?? "Line up a barcode inside the frame"}</Text>
            <Button label="Enter barcode manually" variant="outline" onPress={() => setManualEntry(true)} style={styles.manualButton} />
          </View>
        </>
      )}
    </View>
  );
}

function ManualEntryBlock({ value, onChangeText, onSubmit }: { value: string; onChangeText: (v: string) => void; onSubmit: () => void }) {
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
        onSubmitEditing={onSubmit}
      />
      <Button label="Add" disabled={value.trim().length === 0} onPress={onSubmit} />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },

    overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.lg },
    frame: { width: 240, height: 150, borderWidth: 3, borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: "transparent" },
    hint: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.medium, textAlign: "center" },
    manualButton: { position: "absolute", bottom: spacing.xxl },

    manualContainer: { flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background },
    manualBlock: { gap: spacing.sm },
    label: { fontSize: fontSize.sm, color: colors.mutedForeground },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card },

    permissionContainer: { flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
    permissionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground, textAlign: "center" },
    permissionBody: { fontSize: fontSize.base, color: colors.mutedForeground, textAlign: "center" },
  });
}
