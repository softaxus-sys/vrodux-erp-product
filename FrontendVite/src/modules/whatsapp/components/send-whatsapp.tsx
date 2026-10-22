import * as React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Loader2, Check, CheckCheck, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCanSendWhatsApp, useWaConnection, useWaSend, useWaTemplates, useWaThread } from "@/hooks/whatsapp/use-whatsapp";
import { fillTemplate, type WaMessage } from "@/lib/whatsapp/whatsapp.api";
import { cn, formatDate } from "@/lib/utils";

/**
 * Who a message is for. Any module passes this: a lead, a prospect, an account, an invoice…
 * `fields` are values the sender can drop into a template's {{1}}, {{2}} placeholders.
 */
export interface WhatsAppTarget {
  phone: string | null | undefined;
  name?: string | null;
  relatedType: string;
  relatedId: string;
  relatedName?: string | null;
  fields?: Record<string, string | null | undefined>;
}

/** A "WhatsApp" button for any record screen. Renders nothing for users who cannot send. */
export function SendWhatsAppButton({ target, size = "sm", variant = "outline", className }: {
  target: WhatsAppTarget; size?: "sm" | "default"; variant?: "outline" | "default" | "ghost"; className?: string;
}) {
  const canSend = useCanSendWhatsApp();
  const [open, setOpen] = React.useState(false);
  if (!canSend) return null;
  return (
    <>
      <Button type="button" size={size} variant={variant} className={className}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }} disabled={!target.phone}
        title={target.phone ? "Send a WhatsApp message" : "This record has no phone number"}>
        <MessageSquare className="text-emerald-600" /> WhatsApp
      </Button>
      {open && <SendWhatsAppDialog target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

export function SendWhatsAppDialog({ target, onClose }: { target: WhatsAppTarget; onClose: () => void }) {
  const conn = useWaConnection();
  const templates = useWaTemplates(true);
  const thread = useWaThread(target.relatedType, target.relatedId, target.phone);
  const send = useWaSend();

  const windowOpen = thread.data?.conversation?.windowOpen ?? false;
  const optedOut = thread.data?.conversation?.optedOut ?? false;
  const [mode, setMode] = React.useState<"template" | "text">("template");
  const [phone, setPhone] = React.useState(target.phone ?? "");
  const [templateKey, setTemplateKey] = React.useState("");
  const [values, setValues] = React.useState<string[]>([]);
  const [text, setText] = React.useState("");

  React.useEffect(() => { if (windowOpen) setMode("text"); }, [windowOpen]);

  const template = templates.data?.find((t) => `${t.name}|${t.language}` === templateKey);
  React.useEffect(() => {
    if (!template) return;
    // Pre-fill {{1}} with the contact's first name when the template starts with a greeting placeholder.
    const first = (target.name ?? "").split(" ")[0] ?? "";
    setValues(Array.from({ length: template.variableCount }, (_, i) => (i === 0 ? first : "")));
  }, [templateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = Object.entries(target.fields ?? {}).filter(([, v]) => !!v) as [string, string][];
  const notConnected = conn.data && !conn.data.connected;

  const canSubmit = !!phone.trim() && !optedOut && !send.isPending &&
    (mode === "template" ? !!template && values.every((v) => v.trim()) : !!text.trim() && windowOpen);

  const submit = async () => {
    try {
      const r = await send.mutateAsync({
        to: phone.trim(),
        text: mode === "text" ? text.trim() : undefined,
        templateName: mode === "template" ? template?.name : undefined,
        language: mode === "template" ? template?.language : undefined,
        variables: mode === "template" ? values.map((v) => v.trim()) : undefined,
        relatedType: target.relatedType, relatedId: target.relatedId,
        relatedName: target.relatedName ?? target.name ?? undefined, contactName: target.name ?? undefined,
      });
      if (r.status !== "failed") onClose();
    } catch { /* toast already shown */ }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="size-5 text-emerald-600" /> WhatsApp {target.name}</DialogTitle>
          <DialogDescription>Sent from your workspace's own WhatsApp Business number and saved on this record.</DialogDescription>
        </DialogHeader>

        {notConnected ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            WhatsApp is not connected for this workspace yet. <Link to="/whatsapp/settings" className="font-medium underline">Connect it</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Phone (with country code)</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
            </label>

            {optedOut && (
              <p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                This contact replied STOP. Nothing can be sent until they write to you again.
              </p>
            )}

            <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              {(["template", "text"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={cn("flex-1 rounded-md px-3 py-1.5", mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                  {m === "template" ? "Template" : "Free message"}
                </button>
              ))}
            </div>

            {mode === "template" ? (
              <div className="space-y-3">
                <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                  <option value="">{templates.isLoading ? "Loading templates…" : "Choose an approved template"}</option>
                  {templates.data?.map((t) => (
                    <option key={t.id} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>
                  ))}
                </select>
                {templates.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No approved templates yet. <Link to="/whatsapp/templates" className="underline">Create one</Link> — Meta usually approves within minutes.</p>
                )}
                {template && (
                  <>
                    {values.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                        <Input value={v} onChange={(e) => setValues((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
                        {fields.length > 0 && (
                          <select className="h-10 w-28 rounded-md border bg-card px-1 text-xs" value=""
                            onChange={(e) => e.target.value && setValues((p) => p.map((x, j) => (j === i ? e.target.value : x)))}>
                            <option value="">Insert…</option>
                            {fields.map(([k, val]) => <option key={k} value={val}>{k}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                    <div className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
                      {template.headerText && <p className="mb-1 font-semibold">{template.headerText}</p>}
                      {fillTemplate(template.bodyText, values)}
                      {template.footerText && <p className="mt-1 text-xs text-muted-foreground">{template.footerText}</p>}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {!windowOpen && (
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    WhatsApp only allows a free message within 24 hours of the contact's last reply. Use a template to start the conversation.
                  </p>
                )}
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4096} disabled={!windowOpen}
                  className="w-full rounded-md border bg-card p-3 text-sm" placeholder="Write your message…" />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || !!notConnected}>
            {send.isPending && <Loader2 className="animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MessageStatus({ m }: { m: WaMessage }) {
  if (m.direction === "in") return null;
  const map: Record<string, React.ReactNode> = {
    queued: <Clock className="size-3" />, sent: <Check className="size-3" />,
    delivered: <CheckCheck className="size-3" />, read: <CheckCheck className="size-3 text-sky-500" />,
    failed: <AlertCircle className="size-3 text-red-500" />,
  };
  return <span title={m.error ?? m.status}>{map[m.status] ?? null}</span>;
}

/** WhatsApp history for one record, for its drawer. Renders nothing for users who cannot see WhatsApp. */
export function WhatsAppHistory({ target }: { target: WhatsAppTarget }) {
  const canSend = useCanSendWhatsApp();
  const thread = useWaThread(target.relatedType, target.relatedId, target.phone, canSend);
  if (!canSend) return null;

  const msgs = thread.data?.messages ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">WhatsApp</h4>
        <SendWhatsAppButton target={target} />
      </div>
      {thread.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : msgs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No WhatsApp messages with this contact yet.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm",
                m.direction === "out" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-card")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  {m.origin !== "manual" && m.origin !== "inbound" && <span>{m.origin === "automation" ? "auto" : "auto-reply"} ·</span>}
                  {m.sentByName && m.origin === "manual" && <span>{m.sentByName} ·</span>}
                  <span>{formatDate(m.createdAt)}</span>
                  <MessageStatus m={m} />
                </div>
                {m.status === "failed" && m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
