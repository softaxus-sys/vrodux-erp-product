import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mail, Phone, Globe, MapPin, Building2, User,
  Calendar, DollarSign, Tag, PhoneCall, Users,
  FileText, MessageSquare, Edit, ArrowRight,
  CheckCircle2, TrendingUp, Star, Clock
} from "lucide-react";
import { Trash2, Loader2, Pencil, UserCog, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { sourceLabel, URGENCY_META, leadHeat, buildLeadSummary, type LeadDto as Lead, type LeadStatus } from "@/lib/crm/crm.api";
import { useConvertLead, useSetLeadStatus, useDeleteLead, useAssignLead, useLeadAssignments } from "@/hooks/crm/use-crm";
import { useUsers } from "@/hooks/identity/use-users";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { ActivityTimeline } from "@/modules/crm/activities/components/activity-timeline";
import { Can } from "@/components/auth/can";

type Tab = "overview" | "activity";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "qualified", "unqualified", "converted", "lost"];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:          { label: "New",         color: "text-slate-600",     bg: "bg-slate-100 dark:bg-slate-800/50" },
  contacted:    { label: "Contacted",   color: "text-blue-600",      bg: "bg-blue-50 dark:bg-blue-900/20" },
  qualified:    { label: "Qualified",   color: "text-success",       bg: "bg-success/10" },
  unqualified:  { label: "Unqualified", color: "text-muted-foreground", bg: "bg-muted" },
  converted:    { label: "Converted",   color: "text-primary",       bg: "bg-primary/10" },
  lost:         { label: "Lost",        color: "text-destructive",   bg: "bg-destructive/10" },
};

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "text-destructive", bg: "bg-destructive/10" },
  medium: { label: "Medium", color: "text-warning",     bg: "bg-warning/10" },
  low:    { label: "Low",    color: "text-muted-foreground", bg: "bg-muted" },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-destructive";
  const label = score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";
  const textColor = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Lead Score</span>
        <span className={cn("font-bold", textColor)}>{score}/100 · {label}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Reassign panel ──────────────────────────────────────────────────────────
function ReassignPanel({
  lead, onClose,
}: { lead: Lead; onClose: () => void }) {
  const assign = useAssignLead();
  const { data: usersPage } = useUsers({ pageSize: 200 });
  const users = (usersPage?.items ?? []).filter(u => u.status?.toLowerCase() === "active");
  const [toUserId, setToUserId] = React.useState(lead.assignedToUserId ?? "");
  const [note, setNote] = React.useState("");

  const submit = () => {
    const toName = users.find(u => u.id === toUserId)?.fullName ?? "";
    assign.mutate(
      { id: lead.id, toUserId: toUserId || null, toUserName: toName, note: note.trim() || null },
      { onSuccess: onClose }
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="absolute inset-x-6 top-1/4 z-[61] rounded-xl border border-border bg-background p-5 shadow-2xl space-y-3">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <p className="font-semibold text-sm">Reassign lead</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Hand this lead to another team member. They'll see it under “Assigned to me” and can act on it;
          the change is recorded in the lead's history.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assign to</label>
          <select value={toUserId} onChange={e => setToUserId(e.target.value)}
            className="h-9 w-full px-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="e.g. Contacted — please arrange a site visit"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={assign.isPending}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={submit} disabled={assign.isPending}>
            {assign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}Reassign
          </Button>
        </div>
      </motion.div>
    </>
  );
}

interface Props { lead: Lead | null; open: boolean; onClose: () => void; onEdit?: (lead: Lead) => void; }

export function LeadDrawer({ lead, open, onClose, onEdit }: Props) {
  const [tab, setTab] = React.useState<Tab>("overview");
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);

  const currency = useCurrency();
  const convert = useConvertLead();
  const setStatus = useSetLeadStatus();
  const del = useDeleteLead();
  const assign = useAssignLead();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [showReassign, setShowReassign] = React.useState(false);
  React.useEffect(() => { if (!open) { setConfirmDelete(false); setShowReassign(false); } }, [open]);

  // Role + ownership gating: full-edit roles can act on any lead; assigned-edit roles only on their own.
  const hasRaw = useAuthStore(s => s.hasRawPermission);
  const myUserId = useAuthStore(s => s.user?.id);
  const canEditAll = hasRaw("crm.leads.edit");
  const canEditAssigned = hasRaw("crm.leads-assigned.edit");
  const isMine = !!lead?.assignedToUserId && lead.assignedToUserId === myUserId;
  const canEditThis = canEditAll || (canEditAssigned && isMine);

  const assignments = useLeadAssignments(open && lead ? lead.id : null);

  if (!lead) return null;
  const leadId = lead.id;
  const busy = convert.isPending || setStatus.isPending || del.isPending || assign.isPending;
  const sc = STATUS_CONFIG[lead.status];
  const pc = PRIORITY_CONFIG[lead.priority];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">{getInitials(lead.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight">{lead.fullName}</p>
                  <p className="text-sm text-muted-foreground">{lead.title} · {lead.company}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", pc.color, pc.bg)}>{pc.label} Priority</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEditThis && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowReassign(true)} disabled={busy}>
                    <UserCog className="h-3.5 w-3.5" />Reassign
                  </Button>
                )}
                {canEditThis && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onEdit?.(lead)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview","activity"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {tab === "overview" && (
                <>
                  {/* Score + heat + intent summary */}
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2.5">
                    {(() => { const h = leadHeat(lead.score); return (
                      <div className="flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold", h.color, h.bg)}>
                          <span>{h.emoji}</span>{h.label} lead
                        </span>
                      </div>
                    ); })()}
                    <ScoreBar score={lead.score} />
                    {buildLeadSummary(lead) !== "—" && (
                      <p className="text-xs text-muted-foreground leading-snug pt-0.5">{buildLeadSummary(lead)}</p>
                    )}
                  </div>

                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <DollarSign className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Est. Value</p>
                      <p className="font-bold text-sm">{formatCurrency(lead.estimatedValue, currency)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <Globe className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Source</p>
                      <p className="font-bold text-sm">{sourceLabel(lead.source)}</p>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</h4>
                    <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                      {[
                        { icon: Mail,      label: "Email",         value: <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a> },
                        { icon: Phone,     label: "Phone",         value: lead.phone },
                        { icon: Building2, label: "Company",       value: lead.company },
                        { icon: User,      label: "Industry",      value: lead.industry },
                        { icon: MapPin,    label: "Location",      value: `${lead.city}, ${lead.country}` },
                        { icon: User,      label: "Assigned To",   value: lead.assignedTo },
                        { icon: Calendar,  label: "Created",       value: formatDate(lead.createdDate, "medium") },
                        { icon: Calendar,  label: "Last Contact",  value: lead.lastContactDate ? formatDate(lead.lastContactDate, "medium") : "—" },
                        { icon: Calendar,  label: "Next Follow-up", value: lead.nextFollowUp ? formatDate(lead.nextFollowUp, "medium") : "—" },
                      ].map(row => (
                        <div key={row.label} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                          <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 flex justify-between gap-4 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                            <span className="text-sm font-medium text-right truncate">{row.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements — captured from the lead-gen form */}
                  {(lead.whatsApp || lead.interestedIn || lead.budget || lead.message || lead.purchaseTimeframe) && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requirements</h4>
                      <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                        {lead.purchaseTimeframe && (
                          <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 flex justify-between items-center gap-4 min-w-0">
                              <span className="text-xs text-muted-foreground shrink-0">Planning to buy</span>
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-right truncate">{lead.purchaseTimeframe}</span>
                                {lead.purchaseUrgency && lead.purchaseUrgency !== "unknown" && URGENCY_META[lead.purchaseUrgency] && (
                                  <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                    URGENCY_META[lead.purchaseUrgency].color, URGENCY_META[lead.purchaseUrgency].bg)}>
                                    {URGENCY_META[lead.purchaseUrgency].label}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                        {[
                          { icon: PhoneCall,       label: "WhatsApp",      value: lead.whatsApp
                              ? <a href={`https://wa.me/${(lead.whatsApp || "").replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{lead.whatsApp}</a>
                              : null },
                          { icon: Star,            label: "Interested In",  value: lead.interestedIn },
                          { icon: DollarSign,      label: "Budget",         value: lead.budget },
                        ].filter(r => r.value).map(row => (
                          <div key={row.label} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                            <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 flex justify-between gap-4 min-w-0">
                              <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                              <span className="text-sm font-medium text-right truncate">{row.value}</span>
                            </div>
                          </div>
                        ))}
                        {lead.message && (
                          <div className="flex items-start gap-3 py-2.5">
                            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs text-muted-foreground">Message</span>
                              <p className="text-sm mt-0.5 leading-relaxed whitespace-pre-wrap">{lead.message}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Marketing / attribution — where the lead came from */}
                  {(lead.platform || lead.campaign || lead.formName || lead.adName || lead.adSetName || lead.isOrganic != null || lead.platformCreatedTime) && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Marketing & Attribution</h4>
                      <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                        {[
                          { icon: Globe,      label: "Platform",     value: lead.platform ? <span className="capitalize">{lead.platform}</span> : null },
                          { icon: TrendingUp, label: "Campaign",     value: lead.campaign },
                          { icon: FileText,   label: "Form",         value: lead.formName },
                          { icon: FileText,   label: "Ad",           value: lead.adName },
                          { icon: FileText,   label: "Ad Set",       value: lead.adSetName },
                          { icon: TrendingUp, label: "Traffic Type", value: lead.isOrganic == null ? null : (lead.isOrganic ? "Organic" : "Paid") },
                          { icon: Calendar,   label: "Submitted",    value: lead.platformCreatedTime ? formatDate(lead.platformCreatedTime, "medium") : null },
                        ].filter(r => r.value).map(row => (
                          <div key={row.label} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                            <row.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 flex justify-between gap-4 min-w-0">
                              <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                              <span className="text-sm font-medium text-right truncate">{row.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Form responses — survey Q&A / custom questions (catch-all) */}
                  {lead.customFields && Object.keys(lead.customFields).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Form Responses</h4>
                      <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                        {Object.entries(lead.customFields).map(([q, a]) => (
                          <div key={q} className="py-2.5 border-b border-border/40 last:border-0">
                            <p className="text-xs text-muted-foreground capitalize">{q.replace(/[_-]/g, " ")}</p>
                            <p className="text-sm font-medium mt-0.5 leading-relaxed whitespace-pre-wrap">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {lead.notes && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{lead.notes}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {lead.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignment history — the lead's pipeline handoff trail */}
                  {(assignments.data?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />Assignment History
                      </h4>
                      <div className="space-y-2">
                        {assignments.data!.map(a => (
                          <div key={a.id} className="bg-muted/30 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {a.fromUserName ? `${a.fromUserName} → ` : ""}{a.toUserName || "Unassigned"}
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(a.createdAt, "medium")}</span>
                            </div>
                            {a.assignedByName && <p className="text-xs text-muted-foreground mt-0.5">by {a.assignedByName}</p>}
                            {a.note && <p className="text-xs mt-1 leading-relaxed">{a.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Converted badge */}
                  {lead.status === "converted" && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">Converted to Deal</span>
                      </div>
                      <p className="text-xs text-muted-foreground">This lead has been successfully converted to an active deal in the pipeline.</p>
                    </div>
                  )}
                </>
              )}

              {tab === "activity" && (
                <ActivityTimeline relatedToType="lead" relatedToId={leadId} relatedToName={lead.fullName} assignedTo={lead.assignedTo} />
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              {canEditThis ? (
                <select value={lead.status} disabled={busy}
                  onChange={e => setStatus.mutate({ id: leadId, status: e.target.value })}
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold", sc.color, sc.bg)}>{sc.label}</span>
              )}
              {canEditThis && lead.status !== "converted" && lead.status !== "lost" && lead.status !== "unqualified" && (
                <Button size="sm" className="gap-1.5 h-9 bg-success hover:bg-success/90" disabled={busy}
                  onClick={() => convert.mutate({ id: leadId, body: {} }, { onSuccess: onClose })}>
                  {convert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}Convert to Deal
                </Button>
              )}
              <Can permission="crm.leads.delete">
                <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:bg-destructive/5 ml-auto" disabled={busy}
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </Button>
              </Can>
            </div>

            {/* Delete confirmation */}
            <AnimatePresence>
              {confirmDelete && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 z-[60]" onClick={() => setConfirmDelete(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                    className="absolute inset-x-6 top-1/3 z-[61] rounded-xl border border-border bg-background p-5 shadow-2xl">
                    <p className="font-semibold text-sm">Delete lead?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This will permanently delete <span className="font-medium text-foreground">{lead.fullName}</span>. This cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>Cancel</Button>
                      <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                        onClick={() => del.mutate(leadId, { onSuccess: onClose })}>
                        {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Delete
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Reassign panel */}
            <AnimatePresence>
              {showReassign && <ReassignPanel lead={lead} onClose={() => setShowReassign(false)} />}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

