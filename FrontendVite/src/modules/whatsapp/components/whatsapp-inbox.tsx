import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquare, Search, Send, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCan } from "@/components/auth/can";
import { useWaConnection, useWaConversations, useWaMarkRead, useWaMessages, useWaSend } from "@/hooks/whatsapp/use-whatsapp";
import type { WaConversation } from "@/lib/whatsapp/whatsapp.api";
import { cn, formatDate } from "@/lib/utils";
import { MessageStatus, SendWhatsAppDialog } from "./send-whatsapp";

const RECORD_LINK: Record<string, string> = { lead: "/crm/leads", prospect: "/lead-generation/prospects" };

export function WhatsAppInbox() {
  const canView = useCan("messaging.inbox.view");
  const canSend = useCan("messaging.inbox.send");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const conn = useWaConnection(canView);
  const list = useWaConversations(search, unreadOnly);
  const selectedId = params.get("c");
  const selected = list.data?.find((c) => c.id === selectedId) ?? null;

  if (!canView) return <p className="p-6 text-sm text-muted-foreground">You don't have permission to view WhatsApp conversations.</p>;

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {conn.data?.connected ? `Messages to ${conn.data.displayPhone ?? "your WhatsApp number"}` : "WhatsApp is not connected yet."}
          </p>
        </div>
        {conn.data && !conn.data.connected && <Button asChild size="sm"><Link to="/whatsapp/settings">Connect WhatsApp</Link></Button>}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        <aside className={cn("flex w-full flex-col border-e md:w-80", selected && "hidden md:flex")}>
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" className="ps-8" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
            {list.isError && <p className="p-4 text-sm text-red-600">{(list.error as Error).message}</p>}
            {list.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>}
            {list.data?.map((c) => (
              <button key={c.id} type="button" onClick={() => setParams({ c: c.id })}
                className={cn("flex w-full items-start gap-3 border-b px-3 py-3 text-start hover:bg-muted/50", c.id === selectedId && "bg-muted")}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                  <MessageSquare className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.contactName ?? `+${c.contactPhone}`}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                    {c.unreadCount > 0 && <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">{c.unreadCount}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected
            ? <Chat conv={selected} canSend={canSend} onBack={() => setParams({})} />
            : <div className="m-auto text-sm text-muted-foreground">Choose a conversation</div>}
        </section>
      </div>
    </div>
  );
}

function Chat({ conv, canSend, onBack }: { conv: WaConversation; canSend: boolean; onBack: () => void }) {
  const messages = useWaMessages(conv.id);
  const markRead = useWaMarkRead();
  const send = useWaSend();
  const [text, setText] = React.useState("");
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { if (conv.unreadCount > 0) markRead.mutate(conv.id); }, [conv.id, conv.unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { bottom.current?.scrollIntoView(); }, [messages.data?.length]);

  const submit = async () => {
    if (!text.trim()) return;
    try {
      const r = await send.mutateAsync({ to: conv.contactPhone, text: text.trim() });
      if (r.status !== "failed") setText("");
    } catch { /* toast shown */ }
  };

  return (
    <>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}><ArrowLeft /></Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{conv.contactName ?? `+${conv.contactPhone}`}</p>
          <p className="text-xs text-muted-foreground">
            +{conv.contactPhone}
            {conv.relatedType && conv.relatedName && (
              <> · {RECORD_LINK[conv.relatedType]
                ? <Link className="underline" to={RECORD_LINK[conv.relatedType]}>{conv.relatedType}: {conv.relatedName}</Link>
                : <>{conv.relatedType}: {conv.relatedName}</>}</>
            )}
            {conv.optedOut && <span className="ms-2 text-red-600">Opted out</span>}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
        {messages.data?.map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
              m.direction === "out" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-card")}>
              {m.templateName && <p className="mb-1 text-[10px] uppercase text-muted-foreground">Template · {m.templateName}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                {m.origin === "auto_reply" && <span>auto-reply ·</span>}
                {m.origin === "automation" && <span>automation ·</span>}
                {m.origin === "manual" && m.sentByName && <span>{m.sentByName} ·</span>}
                <span>{formatDate(m.createdAt)}</span>
                <MessageStatus m={m} />
              </div>
              {m.status === "failed" && m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {canSend && (
        <footer className="space-y-2 border-t p-3">
          {!conv.windowOpen ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>More than 24 hours since they wrote — WhatsApp only allows a template now.</span>
              <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)}>Send template</Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4096}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                className="flex-1 resize-none rounded-md border bg-card p-2 text-sm" placeholder="Type a reply (Enter to send)" />
              <Button onClick={submit} disabled={!text.trim() || send.isPending || conv.optedOut}>
                {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          )}
        </footer>
      )}

      {templateOpen && (
        <SendWhatsAppDialog onClose={() => setTemplateOpen(false)} target={{
          phone: `+${conv.contactPhone}`, name: conv.contactName,
          relatedType: conv.relatedType ?? "conversation", relatedId: conv.relatedId ?? conv.id, relatedName: conv.relatedName,
        }} />
      )}
    </>
  );
}
