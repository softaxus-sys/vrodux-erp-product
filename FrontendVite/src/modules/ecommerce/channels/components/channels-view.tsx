import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Loader2, Pause, Plug, RefreshCw, Settings2, ShoppingBag, Store, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import {
  useChannelLocations, useChannels, useConnectChannel, useDisconnectChannel, useProviders, useReplaceToken,
  useSyncChannel, useUpdateChannel,
} from "@/hooks/ecommerce/use-ecommerce";
import { CHANNEL_STATUS_META, meta, type ChannelDto, type SyncResultDto } from "@/lib/ecommerce/ecommerce.api";
import { ConfirmDialog, Field, Modal, PageHeader, Pill, SELECT, useTimeAgo } from "../../shared/ui";

// ── What a sync did, in words ────────────────────────────────────────────────

function useSyncSummary() {
  const { t } = useTranslation("ecommerce");
  return (r: SyncResultDto) => {
    const parts: string[] = [];
    if (r.productsPushed) parts.push(t("sync.products", { count: r.productsPushed }));
    if (r.stockUpdates) parts.push(t("sync.stock", { count: r.stockUpdates }));
    if (r.ordersImported) parts.push(t("sync.orders", { count: r.ordersImported }));
    if (r.ordersCancelled) parts.push(t("sync.cancelled", { count: r.ordersCancelled }));
    return parts.length ? parts.join(" · ") : t("sync.nothing");
  };
}

// ── Connect ──────────────────────────────────────────────────────────────────

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("ecommerce");
  const connect = useConnectChannel();
  const update = useUpdateChannel();
  const [name, setName] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [token, setToken] = React.useState("");
  const [created, setCreated] = React.useState<ChannelDto | null>(null);
  const [location, setLocation] = React.useState("");
  const locations = useChannelLocations(created?.id ?? null, !!created && !created.locationId);

  const canSubmit = domain.trim().length > 3 && token.trim().length > 5 && !connect.isPending;

  const submit = async () => {
    try {
      const ch = await connect.mutateAsync({ kind: "shopify", name: name.trim(), shopDomain: domain.trim(), accessToken: token.trim() });
      setToken("");
      if (ch.locationId) { toast.success(t("connect.done", { name: ch.name })); onClose(); }
      else setCreated(ch);     // several locations: the person chooses where the stock is
    } catch { /* the hook shows the reason; the form stays open for another try */ }
  };

  const saveLocation = async () => {
    if (!created || !location) return;
    try {
      await update.mutateAsync({ id: created.id, body: {
        name: created.name, syncStock: created.syncStock, syncContent: created.syncContent, importOrders: created.importOrders,
        locationId: location, paused: false } });
      toast.success(t("connect.done", { name: created.name }));
      onClose();
    } catch { /* toast shown */ }
  };

  if (created) {
    const active = (locations.data ?? []).filter(l => l.active);
    return (
      <Modal title={t("connect.locationTitle")} subtitle={created.shopDomain} onClose={onClose}
        footer={<>
          <Button variant="outline" onClick={onClose}>{t("connect.later")}</Button>
          <Button disabled={!location || update.isPending} onClick={saveLocation} className="gap-1.5">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}
          </Button>
        </>}>
        <p className="text-sm text-muted-foreground">{t("connect.locationBody")}</p>
        {locations.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <Field label={t("settings.location")}>
            <select className={SELECT} value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">{t("settings.chooseLocation")}</option>
              {active.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}
      </Modal>
    );
  }

  return (
    <Modal title={t("connect.title")} subtitle="Shopify" onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={!canSubmit} onClick={submit} className="gap-1.5">
          {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}{t("connect.submit")}
        </Button>
      </>}>
      <ol className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground list-decimal ps-6">
        <li>{t("connect.step1")}</li>
        <li>{t("connect.step2")}</li>
        <li>{t("connect.step3")}</li>
      </ol>
      <Field label={t("connect.address")} hint={t("connect.addressHint")}>
        <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="your-shop.myshopify.com" autoFocus dir="ltr" />
      </Field>
      <Field label={t("connect.token")} hint={t("connect.tokenHint")}>
        <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="shpat_…" autoComplete="off" dir="ltr" />
      </Field>
      <Field label={t("connect.name")} hint={t("connect.nameHint")}>
        <Input value={name} onChange={e => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function SettingsDialog({ channel, onClose }: { channel: ChannelDto; onClose: () => void }) {
  const { t } = useTranslation("ecommerce");
  const summary = useSyncSummary();
  const update = useUpdateChannel();
  const replace = useReplaceToken();
  const sync = useSyncChannel();
  const locations = useChannelLocations(channel.id);

  const [name, setName] = React.useState(channel.name);
  const [location, setLocation] = React.useState(channel.locationId ?? "");
  const [syncStock, setSyncStock] = React.useState(channel.syncStock);
  const [syncContent, setSyncContent] = React.useState(channel.syncContent);
  const [importOrders, setImportOrders] = React.useState(channel.importOrders);
  const [paused, setPaused] = React.useState(channel.status === "paused");
  const [newToken, setNewToken] = React.useState("");
  const [confirmReset, setConfirmReset] = React.useState(false);

  const save = async () => {
    try {
      await update.mutateAsync({ id: channel.id, body: { name: name.trim(), syncStock, syncContent, importOrders, locationId: location || null, paused } });
      toast.success(t("settings.saved"));
      onClose();
    } catch { /* toast shown */ }
  };

  const changeToken = async () => {
    try {
      await replace.mutateAsync({ id: channel.id, token: newToken.trim() });
      setNewToken("");
      toast.success(t("settings.tokenReplaced"));
    } catch { /* toast shown */ }
  };

  const reset = async () => {
    try {
      const r = await sync.mutateAsync({ id: channel.id, resetStock: true });
      toast.success(summary(r));
      setConfirmReset(false);
    } catch { /* toast shown */ }
  };

  return (
    <>
      <Modal title={t("settings.title")} subtitle={channel.shopDomain} onClose={onClose}
        footer={<>
          <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={!name.trim() || update.isPending} className="gap-1.5">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}
          </Button>
        </>}>
        <Field label={t("connect.name")}><Input value={name} onChange={e => setName(e.target.value)} /></Field>

        <Field label={t("settings.location")} hint={t("settings.locationHint")}>
          <select className={SELECT} value={location} onChange={e => setLocation(e.target.value)} disabled={locations.isLoading}>
            <option value="">{t("settings.chooseLocation")}</option>
            {(locations.data ?? []).filter(l => l.active || l.id === location).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <Toggle checked={syncStock} onChange={setSyncStock} label={t("settings.syncStock")} hint={t("settings.syncStockHint")} />
          <Toggle checked={syncContent} onChange={setSyncContent} label={t("settings.syncContent")} hint={t("settings.syncContentHint")} />
          <Toggle checked={importOrders} onChange={setImportOrders} label={t("settings.importOrders")} hint={t("settings.importOrdersHint")} />
          <Toggle checked={paused} onChange={setPaused} label={t("settings.pause")} hint={t("settings.pauseHint")} />
        </div>

        <Field label={t("settings.newToken")} hint={t("settings.newTokenHint")}>
          <div className="flex gap-2">
            <Input type="password" value={newToken} onChange={e => setNewToken(e.target.value)} placeholder="shpat_…" autoComplete="off" dir="ltr" />
            <Button variant="outline" disabled={newToken.trim().length < 6 || replace.isPending} onClick={changeToken} className="gap-1.5 shrink-0">
              {replace.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{t("settings.replace")}
            </Button>
          </div>
        </Field>

        <div className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("settings.resetTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.resetHint")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={!channel.locationId}>{t("settings.reset")}</Button>
        </div>
      </Modal>
      <AnimatePresence>
        {confirmReset && (
          <ConfirmDialog title={t("settings.resetConfirmTitle")} body={t("settings.resetConfirmBody")} confirmLabel={t("settings.reset")}
            destructive={false} pending={sync.isPending} onConfirm={reset} onClose={() => setConfirmReset(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── A connected store ────────────────────────────────────────────────────────

function ChannelCard({ channel }: { channel: ChannelDto }) {
  const { t } = useTranslation("ecommerce");
  const ago = useTimeAgo();
  const summary = useSyncSummary();
  const sync = useSyncChannel();
  const disconnect = useDisconnectChannel();
  const [settings, setSettings] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);

  const tokenProblem = !!channel.lastError && /access token|permission/i.test(channel.lastError);

  const runSync = async () => {
    try {
      const r = await sync.mutateAsync({ id: channel.id });
      if (r.errors.length) toast.error(r.errors[0]); else toast.success(summary(r));
    } catch { /* toast shown */ }
  };

  return (
    <Card className={cn(channel.status === "error" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><ShoppingBag className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold truncate">{channel.name}</h3>
              <Pill meta={meta(CHANNEL_STATUS_META, channel.status)}>{t(`channelStatus.${channel.status}`)}</Pill>
            </div>
            <p className="text-xs text-muted-foreground" dir="ltr">{channel.shopDomain}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Can permission="ecommerce.listings.edit">
              <Button variant="outline" size="sm" onClick={runSync} disabled={sync.isPending || channel.status === "paused"} className="gap-1.5">
                {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t("card.sync")}
              </Button>
            </Can>
            <Can permission="ecommerce.channels.edit">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettings(true)} aria-label={t("settings.title")}><Settings2 className="h-4 w-4" /></Button>
            </Can>
            <Can permission="ecommerce.channels.delete">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirm(true)} aria-label={t("card.disconnect")}><Trash2 className="h-4 w-4" /></Button>
            </Can>
          </div>
        </div>

        {channel.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">{t("card.problem")}</p>
              <p className="mt-0.5 break-words">{channel.lastError}</p>
              {tokenProblem && <button className="mt-1 underline text-primary" onClick={() => setSettings(true)}>{t("card.fixToken")}</button>}
            </div>
          </div>
        )}
        {channel.status === "paused" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Pause className="h-3.5 w-3.5" />{t("card.pausedNote")}</p>
        )}
        {!channel.locationId && channel.syncStock && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs flex items-center justify-between gap-3">
            <span>{t("card.noLocation")}</span>
            <Button size="sm" variant="outline" onClick={() => setSettings(true)}>{t("card.chooseLocation")}</Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <Link to="/ecommerce/listings" className="rounded-lg border border-border p-2.5 hover:bg-muted/30">
            <p className="text-xl font-bold tabular-nums">{channel.liveListings}</p>
            <p className="text-[11px] text-muted-foreground">{t("card.live")}</p>
          </Link>
          <Link to="/ecommerce/listings" className={cn("rounded-lg border p-2.5 hover:bg-muted/30", channel.failedListings > 0 ? "border-destructive/40" : "border-border")}>
            <p className={cn("text-xl font-bold tabular-nums", channel.failedListings > 0 && "text-destructive")}>{channel.failedListings}</p>
            <p className="text-[11px] text-muted-foreground">{t("card.failed")}</p>
          </Link>
          <Link to="/ecommerce/orders" className="rounded-lg border border-border p-2.5 hover:bg-muted/30">
            <p className="text-xl font-bold tabular-nums">{channel.orders}</p>
            <p className="text-[11px] text-muted-foreground">{t("card.orders")}</p>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {channel.status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            {channel.lastSyncAt ? t("card.synced", { when: ago(channel.lastSyncAt) }) : t("card.neverSynced")}
          </span>
          {channel.locationName && <span>{t("card.stockAt", { location: channel.locationName })}</span>}
          <a href={`https://${channel.shopDomain}/admin`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            {t("card.openAdmin")}<ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>

      <AnimatePresence>
        {settings && <SettingsDialog channel={channel} onClose={() => setSettings(false)} />}
        {confirm && (
          <ConfirmDialog title={t("disconnect.title", { name: channel.name })} body={t("disconnect.body")} confirmLabel={t("card.disconnect")}
            pending={disconnect.isPending}
            onConfirm={async () => { try { await disconnect.mutateAsync(channel.id); setConfirm(false); toast.success(t("disconnect.done")); } catch { /* toast shown */ } }}
            onClose={() => setConfirm(false)} />
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ChannelsView() {
  const { t } = useTranslation("ecommerce");
  const channels = useChannels();
  const providers = useProviders();
  const [connecting, setConnecting] = React.useState(false);

  const list = channels.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("channels.title")} description={t("channels.subtitle")}>
        <Can permission="ecommerce.channels.create">
          <Button onClick={() => setConnecting(true)} className="gap-1.5"><Plug className="h-4 w-4" />{t("channels.connect")}</Button>
        </Can>
      </PageHeader>

      {channels.isLoading && <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>}
      {channels.isError && <div className="p-12 text-center text-sm text-destructive">{(channels.error as Error).message}</div>}

      {!channels.isLoading && list.length === 0 && !channels.isError && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Store className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="font-semibold">{t("channels.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">{t("channels.emptyBody")}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {(providers.data ?? []).map(p => (
                <div key={p.kind} className={cn("rounded-xl border p-4 w-64 text-start", p.available ? "border-border" : "border-dashed opacity-60")}>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.available ? t(`provider.${p.kind}`, { defaultValue: p.description }) : t("provider.soon")}</p>
                  {p.available && (
                    <Can permission="ecommerce.channels.create">
                      <Button size="sm" className="mt-3 gap-1.5" onClick={() => setConnecting(true)}><Plug className="h-3.5 w-3.5" />{t("channels.connect")}</Button>
                    </Can>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map(c => <ChannelCard key={c.id} channel={c} />)}
      </div>

      <AnimatePresence>{connecting && <ConnectDialog onClose={() => setConnecting(false)} />}</AnimatePresence>
    </div>
  );
}
