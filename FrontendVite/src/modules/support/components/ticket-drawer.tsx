import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Send, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  TICKET_STATUS_META, TICKET_PRIORITY_META, TICKET_TRANSITIONS,
  TICKET_PRIORITIES, TICKET_CATEGORIES,
  type TicketStatus, type TicketPriority, type AttachmentInput,
} from "@/lib/support/support.api";
import { useTicket, useAddTicketMessage, useChangeTicketStatus, useAssignTicket, useSetTicketPriority, useSupportAgents } from "@/hooks/support/use-support";
import { useSupportTicketRealtime } from "@/hooks/support/use-support-realtime";
import { AttachmentPicker, AttachmentList } from "@/modules/support/components/attachment-picker";

/**
 * Shared thread/detail drawer for both sides of a ticket. `agentMode` controls which extra
 * controls render (status/priority/assign) — the thread itself renders identically either way,
 * just mirrored: each viewer's own messages align to the right.
 */
export function TicketDrawer({
  ticketId, open, onClose, agentMode = false,
}: {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
  agentMode?: boolean;
}) {
  const { data: t, isLoading } = useTicket(ticketId);
  const addMessage = useAddTicketMessage();
  const changeStatus = useChangeTicketStatus();
  const assign = useAssignTicket();
  const setPriority = useSetTicketPriority();
  const currentUser = useAuthStore(s => s.user);
  const { data: agents = [] } = useSupportAgents(agentMode);
  useSupportTicketRealtime(ticketId, open);

  const [reply, setReply] = React.useState("");
  const [replyAttachments, setReplyAttachments] = React.useState<AttachmentInput[]>([]);

  React.useEffect(() => { setReply(""); setReplyAttachments([]); }, [ticketId]);

  const send = () => {
    if (!ticketId || !reply.trim()) return;
    addMessage.mutate({ id: ticketId, body: reply.trim(), attachments: replyAttachments }, {
      onSuccess: () => { setReply(""); setReplyAttachments([]); },
    });
  };

  const nextStatuses = t ? (TICKET_TRANSITIONS[t.status] ?? []) : [];
  const isAssignedToMe = t?.assignedToUserId && currentUser && t.assignedToUserId === currentUser.id;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {isLoading || !t ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-border">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base leading-tight">{t.subject}</p>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", TICKET_STATUS_META[t.status].color, TICKET_STATUS_META[t.status].bg)}>
                        {TICKET_STATUS_META[t.status].label}
                      </span>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", TICKET_PRIORITY_META[t.priority].color, TICKET_PRIORITY_META[t.priority].bg)}>
                        {t.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{t.ticketNumber}</p>
                    {agentMode && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.requestingTenantName} &middot; {t.requestingUserName}
                        {t.assignedToUserName && <> &middot; assigned to {t.assignedToUserName}</>}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>

                {/* Agent controls */}
                {agentMode && (
                  <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-2">
                    {nextStatuses.map(s => (
                      <Button key={s} size="sm" variant="outline"
                        onClick={() => changeStatus.mutate({ id: t.id, status: s as TicketStatus })}
                        disabled={changeStatus.isPending}>
                        {TICKET_STATUS_META[s].label}
                      </Button>
                    ))}
                    {isAssignedToMe ? (
                      <Button size="sm" variant="outline" onClick={() =>
                        assign.mutate({ id: t.id, assignToUserId: null, assignToUserName: null })}>
                        <UserMinus className="h-3.5 w-3.5 mr-1" /> Unassign
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => currentUser &&
                        assign.mutate({ id: t.id, assignToUserId: String(currentUser.id), assignToUserName: currentUser.name })}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign to me
                      </Button>
                    )}
                    <select
                      className="text-xs rounded-md border border-input bg-card px-2 py-1.5"
                      value={t.assignedToUserId ?? ""}
                      onChange={(e) => {
                        const agentId = e.target.value;
                        const picked = agents.find(a => a.id === agentId);
                        assign.mutate({
                          id: t.id,
                          assignToUserId: picked ? picked.id : null,
                          assignToUserName: picked ? picked.name : null,
                        });
                      }}
                    >
                      <option value="">Hand off to…</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select
                      className="ml-auto text-xs rounded-md border border-input bg-card px-2 py-1.5"
                      value={t.priority}
                      onChange={(e) => setPriority.mutate({ id: t.id, priority: e.target.value as TicketPriority })}
                    >
                      {TICKET_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label} priority</option>)}
                    </select>
                  </div>
                )}

                {/* Category badge, everyone */}
                <div className="px-6 pt-3">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {TICKET_CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                  </span>
                </div>

                {/* Thread */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {t.messages.map(m => {
                    const mine = agentMode ? m.isFromAgent : !m.isFromAgent;
                    return (
                      <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                          mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
                          {m.body}
                        </div>
                        <AttachmentList attachments={m.attachments} />
                        <p className="text-[11px] text-muted-foreground mt-1 px-1">
                          {m.isFromAgent ? "Support" : m.authorName} &middot; {formatDate(m.createdAt)}
                        </p>
                      </div>
                    );
                  })}

                  {agentMode && t.assignmentHistory.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-border space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Assignment history</p>
                      {t.assignmentHistory.map(a => (
                        <p key={a.id} className="text-xs text-muted-foreground">
                          {a.changedByName} {a.toUserName ? `assigned to ${a.toUserName}` : "unassigned"} &middot; {formatDate(a.createdAt)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply box */}
                {t.status !== "closed" && (
                  <div className="border-t border-border p-4">
                    <div className="flex items-end gap-2">
                      <textarea
                        className="flex-1 min-h-[64px] max-h-40 rounded-lg border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Write a reply…"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                        }}
                      />
                      <Button size="icon" onClick={send} disabled={!reply.trim() || addMessage.isPending}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <AttachmentPicker value={replyAttachments} onChange={setReplyAttachments} disabled={addMessage.isPending} />
                      <p className="text-[11px] text-muted-foreground shrink-0 ml-2">Ctrl/Cmd + Enter to send</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
