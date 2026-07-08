import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Landmark, CheckCircle2, Loader2, Plug, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Can, useCan } from "@/components/auth/can";
import { useChannels, useConnectChannel, useDisconnectChannel } from "@/hooks/visa/use-visa";
import type { ChannelDto } from "@/lib/visa/visa.api";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:      { label: "Available",   cls: "text-success bg-success/10" },
  beta:        { label: "Beta",        cls: "text-blue-600 bg-blue-100 dark:bg-blue-900/20" },
  coming_soon: { label: "Coming soon", cls: "text-muted-foreground bg-muted" },
};

function ConnectDrawer({ channel, open, onClose }: { channel: ChannelDto | null; open: boolean; onClose: () => void }) {
  const connect = useConnectChannel();
  const [card, setCard] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [secret, setSecret] = React.useState("");

  React.useEffect(() => {
    if (open && channel) { setCard(channel.establishmentCard ?? ""); setRef(channel.accountRef ?? ""); setSecret(""); }
  }, [open, channel]);

  if (!channel) return null;
  const save = () => connect.mutate(
    { channel: channel.key, establishmentCard: card.trim() || null, accountRef: ref.trim() || null, secret: secret.trim() || null },
    { onSuccess: onClose });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">Connect {channel.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Credentials are encrypted at rest</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed flex gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />{channel.setupGuide}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Establishment card</label>
                <Input value={card} onChange={e => setCard(e.target.value)} placeholder="Establishment / trade licence no." className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account reference / user</label>
                <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="Channel account / user id" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Secret / API key {channel.hasSecret && "(leave blank to keep)"}</label>
                <Input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder={channel.hasSecret ? "•••••• (unchanged)" : "Token or API key"} className="h-9 text-sm" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={connect.isPending}>Cancel</Button>
              <Button onClick={save} disabled={connect.isPending} className="gap-1.5">
                {connect.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save connection
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function VisaChannelsView() {
  const { data: channels = [], isLoading } = useChannels();
  const disconnect = useDisconnectChannel();
  const canEdit = useCan("visa.cases.edit");
  const [connecting, setConnecting] = React.useState<ChannelDto | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Government Channels</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Connect the submission channels your consultancy is onboarded to. UAE has no open visa APIs — Manual works today; the rest activate as partnerships land.</p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading channels…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {channels.map((c, i) => {
            const st = STATUS_META[c.status] ?? STATUS_META.coming_soon;
            const connectable = c.status !== "coming_soon" && c.requiresCredentials;
            return (
              <motion.div key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <Card className="h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Landmark className="h-4 w-4 text-primary" /></div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{c.name}</p>
                          <span className={cn("inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold", st.cls)}>{st.label}</span>
                        </div>
                      </div>
                      {c.connected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success shrink-0"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">{c.description}</p>
                    {!c.connected && (
                      <p className="text-[11px] text-muted-foreground/80 mt-3 bg-muted/30 rounded-lg p-2.5">{c.setupGuide}</p>
                    )}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                      {c.status === "coming_soon" ? (
                        <span className="text-xs text-muted-foreground">Available once a channel partnership is onboarded.</span>
                      ) : !c.requiresCredentials ? (
                        <span className="text-xs text-success inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Ready — no setup needed.</span>
                      ) : (
                        <Can permission="visa.cases.edit" fallback={<span className="text-xs text-muted-foreground">Ask an admin to connect this channel.</span>}>
                          <Button size="sm" variant={c.connected ? "outline" : "default"} className="h-8 text-xs gap-1.5" onClick={() => setConnecting(c)}>
                            <Plug className="h-3.5 w-3.5" />{c.connected ? "Reconfigure" : "Connect"}
                          </Button>
                          {c.connected && (
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/5"
                              disabled={disconnect.isPending} onClick={() => disconnect.mutate(c.key)}>Disconnect</Button>
                          )}
                        </Can>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {canEdit && <ConnectDrawer channel={connecting} open={!!connecting} onClose={() => setConnecting(null)} />}
    </div>
  );
}
