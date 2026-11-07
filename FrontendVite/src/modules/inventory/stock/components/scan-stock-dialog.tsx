import * as React from "react";
import { useTranslation } from "react-i18next";
import { Camera, CameraOff, CheckCircle2, Loader2, PackagePlus, Plus, Scan } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import type { ProductLookupDto } from "@/lib/inventory/types";
import { MovementType } from "@/lib/inventory/types";
import { useCreateStockMovement } from "@/hooks/inventory/use-stock-movements";
import { useWarehouses } from "@/hooks/inventory/use-warehouses";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { AUTOFILL_SOURCE_LABELS } from "@/hooks/use-barcode-autofill";

interface ScanStockDialogProps {
  open: boolean;
  onClose: () => void;
  /** A code nothing in stock matches: open the new-product form already filled in from it. */
  onCreateProduct: (code: string) => void;
}

type Phase = "idle" | "loading" | "result" | "error";

/**
 * Receiving stock by scanning. A USB/Bluetooth scanner, the camera (where the browser can read barcodes) or a
 * typed code identifies the item; for something already in stock you enter how many arrived, for something new
 * the product database pre-fills the new-product form. Stays open so a delivery can be scanned item after item.
 */
export function ScanStockDialog({ open, onClose, onCreateProduct }: ScanStockDialogProps) {
  const { t } = useTranslation("inventory");
  const [code, setCode] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [result, setResult] = React.useState<ProductLookupDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [qty, setQty] = React.useState("1");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [added, setAdded] = React.useState<{ name: string; qty: number }[]>([]);
  const [camera, setCamera] = React.useState(false);

  const codeRef = React.useRef<HTMLInputElement>(null);
  const qtyRef = React.useRef<HTMLInputElement>(null);
  const latest = React.useRef(0);

  const { data: warehouses = [] } = useWarehouses();
  React.useEffect(() => {
    if (open && !warehouseId && warehouses.length > 0) setWarehouseId((warehouses.find(w => w.isDefault) ?? warehouses[0]).id);
  }, [open, warehouses, warehouseId]);

  const createMovement = useCreateStockMovement();

  const reset = React.useCallback(() => {
    latest.current++;
    setCode(""); setPhase("idle"); setResult(null); setError(null); setQty("1");
    window.setTimeout(() => codeRef.current?.focus(), 50);
  }, []);

  React.useEffect(() => {
    if (open) { setAdded([]); reset(); } else { setCamera(false); }
  }, [open, reset]);

  const lookup = React.useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const mine = ++latest.current;
    setCode(value); setPhase("loading"); setResult(null); setError(null);
    try {
      const res = await inventoryProductsApi.lookup(value);
      if (mine !== latest.current) return;
      setResult(res);
      setPhase("result");
      if (res.existing) window.setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 50);
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof Error ? e.message : t("scanStock.lookupFailed", { defaultValue: "Could not look that code up." }));
      setPhase("error");
    }
  }, [t]);

  // A hardware scanner types the code and presses Enter, wherever focus is.
  useBarcodeScanner({
    enabled: open,
    captureFromInputs: true,
    barcodeInputRef: codeRef,
    onScan: ({ barcode }) => { setCamera(false); lookup(barcode); },
  });

  const existing = result?.existing ?? null;
  const quantity = parseFloat(qty);
  const canAdd = !!existing && Number.isFinite(quantity) && quantity > 0 && !createMovement.isPending;

  const addStock = () => {
    if (!existing || !canAdd) return;
    createMovement.mutate(
      {
        productId: existing.id,
        movementType: MovementType.Receipt,
        quantity,
        unitCost: existing.costPrice ?? 0,
        warehouseId: warehouseId || null,
        reference: null,
        notes: t("scanStock.note", { defaultValue: "Received by scanning" }),
      },
      {
        onSuccess: () => {
          toast.success(t("scanStock.added", { defaultValue: "Added {{qty}} to {{name}}", qty: quantity, name: existing.name }));
          setAdded(a => [{ name: existing.name, qty: quantity }, ...a].slice(0, 20));
          reset();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scan className="h-4 w-4" />{t("scanStock.title", { defaultValue: "Scan to add stock" })}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          {t("scanStock.hint", { defaultValue: "Scan a barcode or QR code with your scanner or camera, or type it and press Enter." })}
        </p>

        <div className="flex gap-2">
          <Input
            ref={codeRef}
            value={code}
            autoFocus
            onChange={e => { setCode(e.target.value); if (phase !== "idle") { setPhase("idle"); setResult(null); } }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookup(code); } }}
            placeholder={t("scanStock.placeholder", { defaultValue: "Barcode or QR code" })}
            className="h-9 font-mono text-sm"
          />
          {cameraSupported() && (
            <Button type="button" variant={camera ? "default" : "outline"} size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => setCamera(c => !c)}>
              {camera ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {camera ? t("scanStock.cameraOff", { defaultValue: "Stop" }) : t("scanStock.camera", { defaultValue: "Camera" })}
            </Button>
          )}
        </div>

        {camera && <CameraScanner onCode={c => { setCamera(false); lookup(c); }} onFail={() => { setCamera(false); toast.error(t("scanStock.cameraFailed", { defaultValue: "Could not open the camera." })); }} />}

        {phase === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("scanStock.looking", { defaultValue: "Looking up…" })}</div>
        )}

        {phase === "error" && <p className="text-sm text-destructive">{error}</p>}

        {phase === "result" && existing && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-3">
              {existing.imageUrl && <img src={existing.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{existing.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{existing.sku ?? "—"} · {existing.stockQuantity} {existing.unit} {t("scanStock.inStock", { defaultValue: "in stock" })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("scanStock.quantity", { defaultValue: "Quantity received" })}</label>
                <Input
                  ref={qtyRef} type="number" min={0} step="any" value={qty}
                  onChange={e => setQty(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStock(); } }}
                  className="h-9 text-right text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("scanStock.warehouse", { defaultValue: "Warehouse" })}</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" disabled={!canAdd} onClick={addStock}>
                {createMovement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("scanStock.addStock", { defaultValue: "Add stock" })}
              </Button>
              <Button variant="outline" onClick={reset}>{t("scanStock.cancel", { defaultValue: "Cancel" })}</Button>
            </div>
          </div>
        )}

        {phase === "result" && !existing && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
            {result?.suggested ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("scanStock.notInStock", { defaultValue: "Not in your stock yet. Found in {{source}} — check the details when you create it.", source: AUTOFILL_SOURCE_LABELS[result.suggested.source] ?? result.suggested.sourceLabel })}
                </p>
                <div className="flex items-center gap-3">
                  {result.suggested.imageUrl && <img src={result.suggested.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{result.suggested.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[result.suggested.brand, result.suggested.quantity].filter(Boolean).join(" · ") || result.code}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("scanStock.unknown", { defaultValue: "No product with code {{code}} is in your stock or the product databases. You can still create it by hand.", code: result?.code ?? code })}
              </p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" onClick={() => onCreateProduct(result?.code ?? code)}>
                <PackagePlus className="h-4 w-4" />{t("scanStock.createProduct", { defaultValue: "Create product" })}
              </Button>
              <Button variant="outline" onClick={reset}>{t("scanStock.scanNext", { defaultValue: "Scan another" })}</Button>
            </div>
          </div>
        )}

        {added.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("scanStock.recent", { defaultValue: "Added this session" })}</p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {added.map((a, i) => (
                <li key={i} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" /><span className="min-w-0 flex-1 truncate">{a.name}</span><span className="font-mono text-xs">+{a.qty}</span></li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Camera ────────────────────────────────────────────────────────────────────

const CAMERA_FORMATS = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

/** Chrome, Edge and Android browsers can read barcodes natively; Firefox and desktop Safari cannot, so the button hides there. */
function cameraSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
}

function CameraScanner({ onCode, onFail }: { onCode: (code: string) => void; onFail: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const onCodeRef = React.useRef(onCode);
  const onFailRef = React.useRef(onFail);
  onCodeRef.current = onCode;
  onFailRef.current = onFail;

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: CAMERA_FORMATS });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stream.getTracks().forEach(tr => tr.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            const value = found?.[0]?.rawValue as string | undefined;
            if (value) { onCodeRef.current(value); return; }
          } catch { /* a frame that cannot be read is skipped */ }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch {
        if (!stopped) onFailRef.current();
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach(tr => tr.stop());
    };
  }, []);

  return <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />;
}
