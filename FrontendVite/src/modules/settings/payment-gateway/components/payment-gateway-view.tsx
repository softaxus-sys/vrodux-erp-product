import * as React from "react";
import { Landmark, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import {
  usePaymentGatewayCatalog, usePaymentGatewayConfig, useUpsertPaymentGatewayConfig,
} from "@/hooks/pos/use-payment-gateway";
import type { PaymentGatewayCatalogEntryDto } from "@/lib/pos/payment-gateway.api";

export function PaymentGatewayView() {
  const canEdit = useCan("pos.payment-gateway.edit");
  const { data: catalog = [], isLoading: catalogLoading } = usePaymentGatewayCatalog();
  const { data: config } = usePaymentGatewayConfig();
  const [editing, setEditing] = React.useState<PaymentGatewayCatalogEntryDto | null>(null);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" /> Payment Gateway
        </h1>
        <p className="text-sm text-muted-foreground">
          Select and configure an online payment gateway. "Manual / Terminal" (the default) means card/cash
          payments continue going through your physical terminal, unaffected by this page.
        </p>
      </div>

      {catalogLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map(entry => {
            const isActive = config?.provider === entry.key;
            return (
              <div key={entry.key}
                className={cn("bg-card border rounded-xl p-4 space-y-2", isActive ? "border-primary" : "border-border")}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{entry.displayName}</p>
                  {entry.status === "coming_soon" ? (
                    <span className="flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> Coming soon
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{entry.setupHint}</p>
                {isActive && config && (
                  <p className="text-xs">
                    <span className={cn("font-medium", config.isEnabled ? "text-success" : "text-muted-foreground")}>
                      {config.isEnabled ? "Enabled" : "Disabled"}
                    </span> · {config.mode}
                  </p>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setEditing(entry)}>
                    {isActive ? "Configure" : "Select & Configure"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ConfigureDrawer entry={editing} current={config?.provider === editing.key ? config : null} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ConfigureDrawer({ entry, current, onClose }: {
  entry: PaymentGatewayCatalogEntryDto;
  current: ReturnType<typeof usePaymentGatewayConfig>["data"] | null;
  onClose: () => void;
}) {
  const upsert = useUpsertPaymentGatewayConfig();
  const [apiKey, setApiKey] = React.useState("");
  const [secretKey, setSecretKey] = React.useState("");
  const [publicKey, setPublicKey] = React.useState(current?.publicKey ?? "");
  const [mode, setMode] = React.useState<"test" | "live">(current?.mode ?? "test");
  const [isEnabled, setIsEnabled] = React.useState(current?.isEnabled ?? true);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        provider: entry.key,
        apiKey: apiKey.trim() || null,
        secretKey: secretKey.trim() || null,
        publicKey: entry.needsPublicKey ? (publicKey.trim() || null) : null,
        mode, isEnabled,
      });
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-md mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{entry.displayName}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{entry.setupHint}</p>

        {entry.needsApiKey && (
          <div>
            <label className="text-xs text-muted-foreground">{current?.hasApiKey ? "API Key (leave blank to keep current)" : "API Key"}</label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={current?.hasApiKey ? "•••••••• (unchanged)" : ""} className="h-9 text-sm" />
          </div>
        )}
        {entry.needsSecretKey && (
          <div>
            <label className="text-xs text-muted-foreground">{current?.hasSecretKey ? "Secret Key (leave blank to keep current)" : "Secret Key"}</label>
            <Input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder={current?.hasSecretKey ? "•••••••• (unchanged)" : ""} className="h-9 text-sm" />
          </div>
        )}
        {entry.needsPublicKey && (
          <div>
            <label className="text-xs text-muted-foreground">Publishable Key</label>
            <Input value={publicKey} onChange={e => setPublicKey(e.target.value)} className="h-9 text-sm" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as "test" | "live")}
              className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground mt-5">
            <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} /> Enabled
          </label>
        </div>

        <Button className="w-full" onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
