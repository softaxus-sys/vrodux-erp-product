import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Building2, User, Mail, Phone, Calendar, DollarSign,
  Tag, Activity, MessageSquare, PhoneCall, Users, FileText,
  CheckSquare, TrendingUp, Edit, ArrowRight, Globe
} from "lucide-react";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DealPriorityBadge } from "./deal-status-badge";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { UserPlus, Star } from "lucide-react";
import { PIPELINE_STAGES, FORECAST_META, DEAL_CONTACT_ROLES, type DealDto as Deal } from "@/lib/crm/crm.api";
import {
  useDeleteDeal, useContacts, useDealContacts,
  useAddDealContact, useUpdateDealContactRole, useRemoveDealContact,
} from "@/hooks/crm/use-crm";
import { ActivityTimeline } from "@/modules/crm/activities/components/activity-timeline";
import { useCurrency } from "@/hooks/use-currency";
import { Can } from "@/components/auth/can";

interface Props {
  deal: Deal | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (deal: Deal) => void;
}

const probabilityColor = (p: number) =>
  p >= 70 ? "text-success" : p >= 40 ? "text-warning" : "text-destructive";

import { DocumentsPanel } from "@/modules/crm/shared/components/documents-panel";

type Tab = "overview" | "activities" | "contact" | "documents";

export function DealDrawer({ deal, open, onClose, onEdit }: Props) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const [tab, setTab] = React.useState<Tab>("overview");
  const del = useDeleteDeal();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  React.useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  const currentStageIndex = deal ? PIPELINE_STAGES.findIndex(s => s.key === deal.stage) : -1;

  return (
    <AnimatePresence>
      {open && deal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[640px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex-1 min-w-0 pr-4">
                <p className="font-bold text-lg leading-tight">{deal.title}</p>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{deal.company}</span>
                  <span className="text-border">·</span>
                  <span>{deal.industry}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onEdit?.(deal)}><Pencil className="h-3.5 w-3.5" />{t("dealDrawer.edit")}</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Stage progress */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-1">
                {PIPELINE_STAGES.map((stage, i) => {
                  const isActive = i === currentStageIndex;
                  const isPast = i < currentStageIndex;
                  return (
                    <React.Fragment key={stage.key}>
                      <div className={cn(
                        "flex-1 h-1.5 rounded-full transition-colors",
                        isPast ? "bg-primary" : isActive ? "bg-primary/70" : "bg-muted"
                      )} />
                      {i < PIPELINE_STAGES.length - 1 && <div className="w-0.5" />}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("dealDrawer.stage")} <span className="font-semibold text-foreground">{deal.stage ? t(`stage.${deal.stage}`) : ""}</span>
                </span>
                <div className="flex items-center gap-2">
                  {(() => { const f = FORECAST_META[deal.forecastCategory] ?? FORECAST_META.pipeline;
                    return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", f.color, f.bg)}>{t(`forecast.${deal.forecastCategory ?? "pipeline"}`)}</span>; })()}
                  <span className={cn("text-xs font-bold", probabilityColor(deal.probability))}>
                    {t("dealDrawer.probability", { value: deal.probability })}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview", "activities", "contact", "documents"] as Tab[]).map(tk => (
                <button key={tk} onClick={() => setTab(tk)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    tab === tk ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {t(`dealDrawer.tab.${tk}`)}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="p-6 space-y-6">
                  {/* Key metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/40 rounded-xl p-4 text-center">
                      <DollarSign className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("dealDrawer.dealValue")}</p>
                      <p className="font-bold text-sm">{formatCurrency(deal.value, currency)}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4 text-center">
                      <Calendar className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("dealDrawer.closeDate")}</p>
                      <p className="font-bold text-sm">{formatDate(deal.expectedCloseDate, "medium")}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4 text-center">
                      <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{t("dealDrawer.winChance")}</p>
                      <p className={cn("font-bold text-sm", probabilityColor(deal.probability))}>
                        {deal.probability}%
                      </p>
                    </div>
                  </div>

                  {/* Loss reason */}
                  {deal.stage === "lost" && deal.lossReason && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                      <span className="text-xs font-semibold text-destructive uppercase tracking-wide">{t("dealDrawer.reasonLost")}</span>
                      <p className="text-sm font-medium mt-1">{deal.lossReason}</p>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("dealDrawer.description")}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{deal.description}</p>
                  </div>

                  {/* Details grid */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("dealDrawer.dealDetails")}</h4>
                    <div className="space-y-2.5">
                      {[
                        { label: t("dealDrawer.priority"),      value: <DealPriorityBadge priority={deal.priority} /> },
                        { label: t("dealDrawer.forecast"),      value: t(`forecast.${deal.forecastCategory ?? "pipeline"}`) },
                        { label: t("dealDrawer.weightedValue"), value: formatCurrency(deal.weightedValue, currency) },
                        { label: t("dealDrawer.source"),        value: deal.source },
                        { label: t("dealDrawer.industry"),      value: deal.industry },
                        { label: t("dealDrawer.assignedTo"),    value: deal.assignedTo },
                        { label: t("dealDrawer.created"),       value: formatDate(deal.createdDate, "medium") },
                        { label: t("dealDrawer.currency"),      value: currency },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/40">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className="text-xs font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {deal.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("dealDrawer.tags")}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {deal.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next action */}
                  {deal.nextAction && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">{t("dealDrawer.nextAction")}</span>
                      </div>
                      <p className="text-sm font-medium">{deal.nextAction}</p>
                      {deal.nextActionDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("dealDrawer.due", { date: formatDate(deal.nextActionDate, "medium") })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Activities Tab */}
              {tab === "activities" && (
                <div className="p-6">
                  <ActivityTimeline relatedToType="deal" relatedToId={deal.id} relatedToName={deal.title} assignedTo={deal.assignedTo} />
                </div>
              )}

              {/* Contact Tab */}
              {tab === "contact" && (
                <div className="p-6 space-y-6">
                  <DealContactsPanel dealId={deal.id} customerId={deal.customerId ?? null} company={deal.company} />

                  {/* Assigned rep */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("dealDrawer.accountOwner")}</h4>
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {getInitials(deal.assignedTo)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{deal.assignedTo}</p>
                        <p className="text-xs text-muted-foreground">{t("dealDrawer.accountExecutive")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "documents" && (
                <div className="p-6">
                  <DocumentsPanel relatedToType="deal" relatedToId={deal.id} />
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-3">
              <Button size="sm" className="gap-1.5 h-9" onClick={() => setTab("activities")}>
                <Activity className="h-3.5 w-3.5" />{t("dealDrawer.logActivity")}
              </Button>
              <Can anyOf={["crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit"]}>
                <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:bg-destructive/5 ml-auto" disabled={del.isPending}
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />{t("dealDrawer.delete")}
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
                    <p className="font-semibold text-sm">{t("dealDrawer.deleteTitle")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("dealDrawer.deleteConfirm", { name: deal.title })}
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>{t("dealDrawer.cancel")}</Button>
                      <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                        onClick={() => del.mutate(deal.id, { onSuccess: onClose })}>
                        {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{t("dealDrawer.delete")}
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DealContactsPanel({ dealId, customerId, company }: { dealId: string; customerId: string | null; company: string }) {
  const { t } = useTranslation("crm");
  const { data: linked = [], isLoading } = useDealContacts(dealId);
  const { data: accountContacts = [] } = useContacts(customerId);
  const addContact    = useAddDealContact();
  const updateRole    = useUpdateDealContactRole();
  const removeContact = useRemoveDealContact();

  const [adding, setAdding]   = React.useState(false);
  const [pickId, setPickId]   = React.useState("");
  const [pickRole, setPickRole] = React.useState("decision_maker");

  const linkedIds = new Set(linked.map(l => l.contactId));
  const available = accountContacts.filter(c => !linkedIds.has(c.id));

  const submitAdd = () => {
    if (!pickId) return;
    addContact.mutate({ dealId, contactId: pickId, role: pickRole }, {
      onSuccess: () => { setAdding(false); setPickId(""); setPickRole("decision_maker"); },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("dealDrawer.contacts", { count: linked.length })}</h4>
        {customerId && (
          <Can anyOf={["crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit"]}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setAdding(v => !v)} disabled={available.length === 0}>
              <UserPlus className="h-3.5 w-3.5" />{t("dealDrawer.add")}
            </Button>
          </Can>
        )}
      </div>

      {!customerId && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 mb-4">
          {t("dealDrawer.linkAccountHint")}
        </p>
      )}

      {adding && customerId && (
        <div className="rounded-xl border border-border p-3 mb-4 space-y-2">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("dealDrawer.allLinked", { company })}</p>
          ) : (
            <>
              <select value={pickId} onChange={e => setPickId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">{t("dealDrawer.selectContact")}</option>
                {available.map(c => <option key={c.id} value={c.id}>{c.fullName}{c.title ? ` — ${c.title}` : ""}</option>)}
              </select>
              <div className="flex gap-2">
                <select value={pickRole} onChange={e => setPickRole(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {DEAL_CONTACT_ROLES.map(r => <option key={r.value} value={r.value}>{t(`contactRole.${r.value}`)}</option>)}
                </select>
                <Button size="sm" className="h-9" onClick={submitAdd} disabled={!pickId || addContact.isPending}>
                  {addContact.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("dealDrawer.link")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : linked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">{t("dealDrawer.noContacts")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {linked.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{getInitials(c.fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm truncate">{c.fullName}</p>
                  {c.isPrimary && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                </div>
                {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  {c.email && <a href={`mailto:${c.email}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{c.email}</a>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Can anyOf={["crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit"]} fallback={<span className="text-[11px] font-medium text-muted-foreground px-2 py-1">{t(`contactRole.${c.role}`)}</span>}>
                  <select value={c.role} onChange={e => updateRole.mutate({ dealId, id: c.id, role: e.target.value })}
                    className="h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {DEAL_CONTACT_ROLES.map(r => <option key={r.value} value={r.value}>{t(`contactRole.${r.value}`)}</option>)}
                  </select>
                  <button onClick={() => removeContact.mutate({ dealId, id: c.id })} disabled={removeContact.isPending}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label="Unlink contact">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Can>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

