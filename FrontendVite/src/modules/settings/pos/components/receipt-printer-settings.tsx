import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Usb, Wifi, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { printApi, type PrinterMode, type PrinterChoice } from "@/lib/pos/print.api";

/**
 * Settings -> Receipt Printer. Picks the printer the till prints receipts on, per store.
 * The list is the printers installed in Windows on the SERVER PC (where the Vrodux service runs) -
 * that is the machine that actually talks to a USB receipt printer.
 */
export function ReceiptPrinterSettings() {
  const qc      = useQueryClient();
  const canEdit = useCan("pos.sessions.approve");

  const info = useQuery({ queryKey: ["pos-printers"], queryFn: printApi.getPrinters, retry: 1, enabled: canEdit });
  const status = useQuery({ queryKey: ["pos-printer-status"], queryFn: printApi.getStatus, retry: 0 });

  const [mode, setMode] = React.useState<PrinterMode>("windows");
  const [name, setName] = React.useState("");
  const [ip,   setIp]   = React.useState("");
  const [port, setPort] = React.useState("9100");
  const [busy, setBusy] = React.useState<"save" | "test" | null>(null);

  // Start from what's saved; otherwise from the server's config file / auto-detected printer.
  React.useEffect(() => {
    const d = info.data;
    if (!d) return;
    const m = (d.savedMode ?? (d.fileMode === "network" ? "network" : "windows")) as PrinterMode;
    setMode(m);
    setName(d.savedName ?? (d.printers.includes(d.fileName) ? d.fileName : (d.autoDetected ?? d.printers[0] ?? "")));
    setIp(d.savedIp ?? d.fileIp ?? "");
    setPort(String(d.savedPort ?? d.filePort ?? 9100));
  }, [info.data]);

  const choice = (): PrinterChoice => ({
    mode,
    printerName: mode === "windows" ? name : null,
    printerIp:   mode === "network" ? ip.trim() : null,
    printerPort: mode === "network" ? (parseInt(port, 10) || 9100) : null,
  });

  const valid = mode === "windows" ? !!name : !!ip.trim();

  const run = async (kind: "save" | "test") => {
    setBusy(kind);
    try {
      const r = kind === "save" ? await printApi.saveSettings(choice()) : await printApi.testPrint(choice());
      toast.success(kind === "save" ? "Receipt printer saved." : `Test sent - ${r.message}`);
      if (kind === "save") {
        qc.invalidateQueries({ queryKey: ["pos-printers"] });
        qc.invalidateQueries({ queryKey: ["pos-printer-status"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The printer did not respond.");
    } finally {
      setBusy(null);
    }
  };

  const st = status.data;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Receipt Printer</h1>
        <p className="text-sm text-muted-foreground">
          Choose the printer the POS prints receipts on. USB printers must be installed in Windows on the computer running the Vrodux server.
        </p>
      </div>

      {/* Current status */}
      <div className={cn("rounded-xl border p-4 flex items-start gap-3",
        st?.reachable ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
        {status.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          : st?.reachable ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
        <div className="text-sm min-w-0 flex-1">
          <p className="font-semibold">
            {status.isLoading ? "Checking printer..." : st?.reachable ? "Printer ready" : "Printer not available"}
          </p>
          <p className="text-muted-foreground truncate">
            {st?.reachable
              ? (st.mode === "network" ? `${st.ip}:${st.port}` : st.printer)
              : (st?.message ?? "Could not reach the print service.")}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { status.refetch(); info.refetch(); }} title="Check again">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">Only a POS supervisor or administrator can change the receipt printer.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          {/* Connection type */}
          <div className="grid grid-cols-2 gap-2">
            {([["windows", "USB / installed printer", Usb], ["network", "Network printer (IP)", Wifi]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium text-left",
                  mode === m ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40")}>
                <Icon className="h-4 w-4 shrink-0" /> {label}
              </button>
            ))}
          </div>

          {mode === "windows" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Printer</label>
              {info.isLoading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading printers...</div>
              ) : (info.data?.printers.length ?? 0) === 0 ? (
                <p className="text-sm text-amber-700">
                  {info.data && !info.data.isWindows
                    ? "The server is not running on Windows, so it has no USB printers. Use a network printer."
                    : "No printers are installed on the server PC. Install the receipt printer's driver in Windows, then press refresh."}
                </p>
              ) : (
                <select value={name} onChange={e => setName(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm">
                  {info.data!.printers.map(p => (
                    <option key={p} value={p}>{p}{p === info.data!.autoDetected ? "  (detected receipt printer)" : ""}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Printer IP address</label>
                <Input value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.50" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Port</label>
                <Input value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ""))} placeholder="9100" className="h-9" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" disabled={!valid || busy !== null} onClick={() => run("test")}>
              {busy === "test" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
              Test print
            </Button>
            <Button disabled={!valid || busy !== null} onClick={() => run("save")}>
              {busy === "save" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Test print uses the choice above without saving it, so you can try printers before choosing one.
          </p>
        </div>
      )}
    </div>
  );
}
