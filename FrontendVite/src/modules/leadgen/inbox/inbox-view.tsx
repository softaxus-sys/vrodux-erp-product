import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, ArrowLeft, Inbox, Loader2, RefreshCw, Send, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { THREAD_CLASSES, type ThreadDto } from "@/lib/leadgen/leadgen.api";
import { useMailboxes, useReply, useSyncMailbox, useThread, useThreads, useUpdateThread } from "@/hooks/leadgen/use-leadgen";
import { Banner, EmptyState, ErrorBlock, LeadGenFrame, LoadingBlock, NoAccess, Pager, SearchBox, SELECT, TEXTAREA, formatDateTime, useCanAny, useDebounced } from "../shared/ui";

const CLASS_TONE: Record<string, string> = {
  interested: "text-success bg-success/10", question: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  not_interested: "text-muted-foreground bg-muted", out_of_office: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  unsubscribe: "text-destructive bg-destructive/10", bounce: "text-destructive bg-destructive/10", none: "",
};

function ClassPill({ value }: { value: string }) {
  const { t } = useTranslation("leadgen");
  if (value === "none") return null;
  return <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold", CLASS_TONE[value])}>{t(`thread.class.${value}`)}</span>;
}

type Tab = "all" | "unread" | "mine" | "archived";

export function InboxView() {
  const { t } = useTranslation("leadgen");
  const canView = useCanAny(["leadgen.inbox.view"]);
  const [params, setParams] = useSearchParams();
  const selected = params.get("thread");
  const [tab, setTab] = React.useState<Tab>("all");
  const [label, setLabel] = React.useState("");
  const [mailboxId, setMailboxId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search, 350);
  React.useEffect(() => { setPage(1); }, [tab, label, mailboxId, debounced]);

  const mailboxes = useMailboxes(canView);
  const list = useThreads({
    unread: tab === "unread" ? true : undefined, mine: tab === "mine" ? true : undefined, archived: tab === "archived",
    classification: label || undefined, mailboxId: mailboxId || undefined, search: debounced || undefined, repliesOnly: true, page, pageSize: 30,
  }, canView);
  const sync = useSyncMailbox();
  const connected = (mailboxes.data ?? []).filter(m => m.status === "connected");

  const open = (id: string | null) => { const p = new URLSearchParams(params); id ? p.set("thread", id) : p.delete("thread"); setParams(p, { replace: true }); };
  const checkNow = async () => { for (const m of connected) { try { await sync.mutateAsync(m.id); } catch { /* the hook shows why */ } } };

  if (!canView) return <LeadGenFrame title={t("inbox.title")}><NoAccess permission="leadgen.inbox.view" /></LeadGenFrame>;

  const rows = list.data?.items ?? [];
  return (
    <LeadGenFrame title={t("inbox.title")} description={t("inbox.description")}
      actions={connected.length > 0 && (
        <Can anyOf={["leadgen.inbox.edit", "leadgen.mailboxes.edit"]}>
          <Button variant="outline" className="gap-2" disabled={sync.isPending} onClick={checkNow}>
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t("inbox.checkNow")}
          </Button>
        </Can>
      )}>
      {!mailboxes.isLoading && connected.length === 0 && <Banner tone="info">{t("inbox.noMailbox")}</Banner>}

      <div className="rounded-xl border border-border bg-card overflow-hidden grid lg:grid-cols-[380px_1fr] min-h-[560px]">
        {/* List */}
        <div className={cn("border-e border-border flex-col min-h-0", selected ? "hidden lg:flex" : "flex")}>
          <div className="p-3 space-y-2 border-b border-border">
            <div className="flex gap-1">
              {(["all", "unread", "mine", "archived"] as Tab[]).map(k => (
                <button key={k} onClick={() => setTab(k)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium", tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted/50")}>{t(`inbox.tab.${k}`)}</button>
              ))}
            </div>
            <SearchBox value={search} onChange={setSearch} placeholder={t("inbox.search")} />
            <div className="grid grid-cols-2 gap-2">
              <select className={cn(SELECT, "h-8 text-xs")} value={label} onChange={e => setLabel(e.target.value)} aria-label={t("inbox.label")}>
                <option value="">{t("inbox.allLabels")}</option>{THREAD_CLASSES.filter(c => c !== "none").map(c => <option key={c} value={c}>{t(`thread.class.${c}`)}</option>)}
              </select>
              <select className={cn(SELECT, "h-8 text-xs")} value={mailboxId} onChange={e => setMailboxId(e.target.value)} aria-label={t("inbox.mailbox")}>
                <option value="">{t("inbox.allMailboxes")}</option>{(mailboxes.data ?? []).map(m => <option key={m.id} value={m.id}>{m.address}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {list.isLoading ? <LoadingBlock />
              : list.error ? <ErrorBlock error={list.error as Error} onRetry={() => list.refetch()} />
              : rows.length === 0 ? <EmptyState icon={Inbox} title={t("inbox.emptyTitle")} body={t("inbox.emptyBody")} />
              : <ul className="divide-y divide-border">{rows.map(th => <ThreadRow key={th.id} th={th} active={th.id === selected} onOpen={() => open(th.id)} />)}</ul>}
          </div>
          <Pager page={page} pageSize={30} total={list.data?.total ?? 0} onPage={setPage} />
        </div>

        {/* Conversation */}
        <div className={cn("min-h-0", selected ? "block" : "hidden lg:block")}>
          {selected ? <Conversation key={selected} id={selected} onBack={() => open(null)} />
            : <EmptyState icon={Inbox} title={t("inbox.pickTitle")} body={t("inbox.pickBody")} />}
        </div>
      </div>
    </LeadGenFrame>
  );
}

function ThreadRow({ th, active, onOpen }: { th: ThreadDto; active: boolean; onOpen: () => void }) {
  const unread = th.unreadCount > 0;
  return (
    <li>
      <button onClick={onOpen} className={cn("w-full text-start px-4 py-3 hover:bg-muted/30 transition-colors", active && "bg-primary/5")}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-sm truncate", unread ? "font-bold" : "font-medium")}>{th.prospectName ?? th.counterparty}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(th.lastMessageAt, "relative")}</span>
        </div>
        <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground" : "text-muted-foreground")}>{th.subject}</p>
        <div className="flex items-center gap-2 mt-1">
          {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />}
          <p className="text-[11px] text-muted-foreground truncate flex-1">{th.snippet}</p>
          <ClassPill value={th.classification} />
        </div>
      </button>
    </li>
  );
}

function Conversation({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation("leadgen");
  const user = useAuthStore(s => s.user);
  const q = useThread(id);
  const reply = useReply();
  const update = useUpdateThread();
  const [text, setText] = React.useState("");
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const th = q.data?.thread;

  // Opening a conversation reads it.
  const markedRef = React.useRef(false);
  React.useEffect(() => {
    if (th && th.unreadCount > 0 && !markedRef.current) { markedRef.current = true; update.mutate({ id, markRead: true }); }
  }, [th?.unreadCount]);  // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [q.data?.messages.length]);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error as Error} onRetry={() => q.refetch()} />;
  if (!th) return null;
  const mine = th.assignedUserId && th.assignedUserId === user?.id;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-14rem)] min-h-[560px]">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-start gap-2">
          <button className="lg:hidden p-1 -ms-1 text-muted-foreground" onClick={onBack} aria-label={t("action.back")}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{th.subject}</p>
            <p className="text-xs text-muted-foreground truncate">
              {th.prospectName ? <Link className="text-primary hover:underline" to={`/lead-generation/prospects`}>{th.prospectName}</Link> : null}{th.prospectName ? " · " : ""}{th.counterparty}
              {th.campaignName ? ` · ${th.campaignName}` : ""}
            </p>
          </div>
        </div>
        <Can permission="leadgen.inbox.edit">
          <div className="flex flex-wrap items-center gap-2">
            <select className={cn(SELECT, "h-8 w-auto text-xs")} value={th.classification} aria-label={t("inbox.label")}
              onChange={e => update.mutate({ id, classification: e.target.value })}>
              {THREAD_CLASSES.map(c => <option key={c} value={c}>{c === "none" ? t("inbox.noLabel") : t(`thread.class.${c}`)}</option>)}
            </select>
            {mine
              ? <Button size="sm" variant="outline" className="gap-1.5" onClick={() => update.mutate({ id, clearAssignee: true })}><UserMinus className="h-3.5 w-3.5" />{t("inbox.unassign")}</Button>
              : <Button size="sm" variant="outline" className="gap-1.5" onClick={() => user && update.mutate({ id, assignedUserId: user.id, assignedName: user.name })}><UserCheck className="h-3.5 w-3.5" />{t("inbox.assignToMe")}</Button>}
            {th.assignedName && !mine && <span className="text-xs text-muted-foreground">{t("inbox.assignedTo", { name: th.assignedName })}</span>}
            <Button size="sm" variant="ghost" className="gap-1.5 ms-auto" onClick={() => update.mutate({ id, archived: !th.isArchived })}>
              {th.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{th.isArchived ? t("inbox.unarchive") : t("inbox.archive")}
            </Button>
          </div>
        </Can>
        {th.classification === "unsubscribe" && <Banner tone="bad">{t("inbox.unsubscribeNote")}</Banner>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {q.data!.messages.map(m => (
          <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm border",
              m.direction === "out" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
              <p className={cn("text-[11px] mb-1.5", m.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {m.direction === "out" ? t("inbox.you") : m.from} · {formatDateTime(m.occurredAt)}
                {m.status === "bounced" && <span className="ms-2 font-semibold">{t("status.bounced")}</span>}
                {m.status === "failed" && <span className="ms-2 font-semibold">{t("status.failed")}</span>}
              </p>
              <p className="whitespace-pre-wrap break-words leading-relaxed" dir="auto">{m.bodyText}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <Can permission="leadgen.inbox.send" fallback={<p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">{t("inbox.cannotReply")}</p>}>
        <form className="p-3 border-t border-border space-y-2" onSubmit={e => { e.preventDefault(); if (text.trim()) reply.mutate({ id, body: text }, { onSuccess: () => setText("") }); }}>
          <textarea className={cn(TEXTAREA, "min-h-[84px]")} value={text} maxLength={10000} onChange={e => setText(e.target.value)} placeholder={t("inbox.replyPlaceholder")}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) { e.preventDefault(); reply.mutate({ id, body: text }, { onSuccess: () => setText("") }); } }} />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">{t("inbox.sendHint")}</p>
            <Button type="submit" className="gap-2" disabled={!text.trim() || reply.isPending}>{reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t("inbox.send")}</Button>
          </div>
        </form>
      </Can>
    </div>
  );
}
