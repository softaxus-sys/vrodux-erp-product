import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Globe, Phone, Mail, MapPin, Building2, User,
  Calendar, DollarSign, Star, TrendingUp, Tag,
  PhoneCall, Users, FileText, MessageSquare, Edit,
  CheckCircle2, Clock, XCircle, Award, Stamp
} from "lucide-react";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { CustomerDto as Customer } from "@/lib/crm/crm.api";
import { useDeleteCustomer, useDeals } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import { AccountTimeline } from "./account-timeline";
import { ContactsPanel } from "./contacts-panel";
import { Can, useCan } from "@/components/auth/can";
import { useCustomerVisaCases } from "@/hooks/visa/use-visa";
import { CASE_STATUS_META } from "@/lib/visa/visa.api";

import { DocumentsPanel } from "@/modules/crm/shared/components/documents-panel";

type Tab = "overview" | "contacts" | "deals" | "activity" | "documents";

const TIER_CONFIG = {
  platinum: { color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30", icon: "💎" },
  gold:     { color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30",  icon: "🥇" },
  silver:   { color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-700/50",  icon: "🥈" },
  standard: { color: "text-muted-foreground", bg: "bg-muted",                     icon: "⭐" },
};

const STATUS_CONFIG = {
  active:   { color: "text-success",     bg: "bg-success/10",     dot: "bg-success" },
  inactive: { color: "text-muted-foreground", bg: "bg-muted",    dot: "bg-muted-foreground" },
  at_risk:  { color: "text-warning",     bg: "bg-warning/10",     dot: "bg-warning" },
  churned:  { color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" },
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  won: "text-success bg-success/10", lost: "text-destructive bg-destructive/10",
  negotiation: "text-amber-600 bg-amber-100 dark:bg-amber-900/20",
  proposal: "text-violet-600 bg-violet-100 dark:bg-violet-900/20",
  qualified: "text-blue-600 bg-blue-100 dark:bg-blue-900/20",
  lead: "text-slate-600 bg-slate-100 dark:bg-slate-800/50",
};

function NpsGauge({ score }: { score: number }) {
  const { t } = useTranslation("crm");
  const color = score >= 8 ? "text-success" : score >= 6 ? "text-warning" : "text-destructive";
  const label = score >= 9 ? t("customerDrawer.promoter") : score >= 7 ? t("customerDrawer.passive") : t("customerDrawer.detractor");
  return (
    <div className="flex items-center gap-3">
      <div className={cn("text-3xl font-bold", color)}>{score}</div>
      <div>
        <p className="text-xs text-muted-foreground">{t("customerDrawer.npsScore")}</p>
        <p className={cn("text-xs font-semibold", color)}>{label}</p>
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden ml-2">
        <div className={cn("h-full rounded-full", score >= 8 ? "bg-success" : score >= 6 ? "bg-warning" : "bg-destructive")}
          style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  );
}

interface Props { customer: Customer | null; open: boolean; onClose: () => void; onEdit?: (c: Customer) => void; }

export function CustomerDrawer({ customer, open, onClose, onEdit }: Props) {
  const { t } = useTranslation("crm");
  const [tab, setTab] = React.useState<Tab>("overview");
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  const del = useDeleteCustomer();
  const currency = useCurrency();
  const { data: linkedDeals = [], isLoading: dealsLoading } = useDeals(customer?.id, !!customer && open);
  const canViewVisa = useCan("visa.cases.view");
  const { data: visaCases = [] } = useCustomerVisaCases(customer?.id ?? null, canViewVisa && open);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  React.useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  if (!customer) return null;
  const tier = TIER_CONFIG[customer.tier];
  const status = STATUS_CONFIG[customer.status];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[640px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex items-start gap-4 flex-1 min-w-0 pr-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-lg leading-tight">{customer.name}</p>
                  {customer.tradeName && <p className="text-xs text-muted-foreground">{customer.tradeName}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", status.color, status.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />{t(`customerStatus.${customer.status}`)}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", tier.color, tier.bg)}>
                      {tier.icon} {t(`tier.${customer.tier}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">{customer.industry}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onEdit?.(customer)}><Pencil className="h-3.5 w-3.5" />{t("customerDrawer.edit")}</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Quick metrics */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                { label: t("customerDrawer.totalRevenue"), value: formatCurrency(customer.totalRevenue, customer.currency || currency), sub: t("customerDrawer.lifetime") },
                { label: t("customerDrawer.openDeals"),   value: customer.openDeals, sub: t("customerDrawer.active") },
                { label: t("customerDrawer.customerSince"), value: new Date(customer.since).getFullYear(), sub: formatDate(customer.since, "medium") },
              ].map(m => (
                <div key={m.label} className="px-5 py-3 text-center">
                  <p className="font-bold text-base">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview","contacts","deals","activity","documents"] as Tab[]).map(tk => (
                <button key={tk} onClick={() => setTab(tk)}
                  className={cn("px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    tab === tk ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t(`customerDrawer.tab.${tk}`)}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* OVERVIEW */}
              {tab === "overview" && (
                <div className="p-6 space-y-6">
                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{customer.description}</p>

                  {/* Company info */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("customerDrawer.companyInformation")}</h4>
                    <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                      {[
                        { icon: Globe,    label: t("customerDrawer.website"),    value: customer.website ? <a href={`https://${customer.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{customer.website}</a> : "—" },
                        { icon: Phone,    label: t("customerDrawer.phone"),      value: customer.phone },
                        { icon: Mail,     label: t("customerDrawer.email"),      value: <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email}</a> },
                        { icon: MapPin,   label: t("customerDrawer.location"),   value: `${customer.city}, ${customer.country}` },
                        { icon: Building2,label: t("customerDrawer.employees"),  value: customer.employees ?? "—" },
                        { icon: User,     label: t("customerDrawer.accManager"), value: customer.accountManager },
                        { icon: Calendar, label: t("customerDrawer.lastActivity"), value: customer.lastActivity ? formatDate(customer.lastActivity, "medium") : "—" },
                        { icon: Calendar, label: t("customerDrawer.contractRenewal"), value: customer.contractRenewal ? formatDate(customer.contractRenewal, "medium") : "—" },
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

                  {/* NPS */}
                  {customer.npsScore !== undefined && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("customerDrawer.customerSatisfaction")}</h4>
                      <div className="bg-muted/30 rounded-xl p-4">
                        <NpsGauge score={customer.npsScore} />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {customer.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("customerDrawer.tags")}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {customer.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visa cases linked to this account */}
                  {canViewVisa && visaCases.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Stamp className="h-3.5 w-3.5" />{t("customerDrawer.visaCases", { count: visaCases.length })}
                      </h4>
                      <div className="space-y-2">
                        {visaCases.map(vc => {
                          const m = CASE_STATUS_META[vc.status];
                          return (
                            <div key={vc.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{vc.visaTypeName}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">{vc.caseNumber}</p>
                              </div>
                              {m && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0", m.color, m.bg)}>{m.label}</span>}
                              <p className="font-semibold text-sm shrink-0">{formatCurrency(vc.serviceFee + vc.govtFee, currency)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CONTACTS */}
              {tab === "contacts" && (
                <div className="p-6">
                  <ContactsPanel customerId={customer.id} />
                </div>
              )}

              {/* DEALS */}
              {tab === "deals" && (
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">{t("customerDrawer.deals", { count: linkedDeals.length })}</h4>
                  </div>
                  {dealsLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : linkedDeals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <DollarSign className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("customerDrawer.noDeals")}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">{t("customerDrawer.noDealsHint")}</p>
                    </div>
                  ) : linkedDeals.map((deal, i) => {
                    const statusColor = DEAL_STATUS_COLORS[deal.stage] ?? "text-muted-foreground bg-muted";
                    const open = deal.stage !== "won" && deal.stage !== "lost";
                    return (
                      <motion.div key={deal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{deal.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", statusColor)}>{t(`stage.${deal.stage}`)}</span>
                            {deal.expectedCloseDate && <span className="text-[11px] text-muted-foreground">{formatDate(deal.expectedCloseDate, "medium")}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(deal.value, currency)}</p>
                          {open && <p className="text-[11px] text-muted-foreground">{t("customerDrawer.weighted", { value: formatCurrency(deal.weightedValue, currency) })}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ACTIVITY */}
              {tab === "activity" && (
                <div className="p-6">
                  <AccountTimeline customerId={customer.id} customerName={customer.name} accountManager={customer.accountManager} />
                </div>
              )}

              {tab === "documents" && (
                <div className="p-6">
                  <DocumentsPanel relatedToType="customer" relatedToId={customer.id} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              <Button size="sm" className="gap-1.5 h-9" onClick={() => setTab("activity")}><MessageSquare className="h-3.5 w-3.5" />{t("customerDrawer.logActivity")}</Button>
              <Can permission="crm.customers.delete">
                <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:bg-destructive/5 ml-auto" disabled={del.isPending}
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />{t("customerDrawer.delete")}
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
                    <p className="font-semibold text-sm">{t("customerDrawer.deleteTitle")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("customerDrawer.deleteConfirm", { name: customer.name })}
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>{t("customerDrawer.cancel")}</Button>
                      <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                        onClick={() => del.mutate(customer.id, { onSuccess: onClose })}>
                        {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{t("customerDrawer.delete")}
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

