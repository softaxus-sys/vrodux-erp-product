import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Globe, Phone, Mail, MapPin, Building2, User,
  Calendar, DollarSign, Star, TrendingUp, Tag,
  PhoneCall, Users, FileText, MessageSquare, Edit,
  ChevronRight, CheckCircle2, Clock, XCircle, Award
} from "lucide-react";
import { Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { CustomerDto as Customer } from "@/lib/crm/crm.api";
import { useDeleteCustomer } from "@/hooks/crm/use-crm";
import { ActivityTimeline } from "@/modules/crm/activities/components/activity-timeline";
import { ContactsPanel } from "./contacts-panel";

type Tab = "overview" | "contacts" | "deals" | "activity";

const TIER_CONFIG = {
  platinum: { label: "Platinum", color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30", icon: "💎" },
  gold:     { label: "Gold",     color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30",  icon: "🥇" },
  silver:   { label: "Silver",   color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-700/50",  icon: "🥈" },
  standard: { label: "Standard", color: "text-muted-foreground", bg: "bg-muted",                     icon: "⭐" },
};

const STATUS_CONFIG = {
  active:   { label: "Active",   color: "text-success",     bg: "bg-success/10",     dot: "bg-success" },
  inactive: { label: "Inactive", color: "text-muted-foreground", bg: "bg-muted",    dot: "bg-muted-foreground" },
  at_risk:  { label: "At Risk",  color: "text-warning",     bg: "bg-warning/10",     dot: "bg-warning" },
  churned:  { label: "Churned",  color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" },
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  won: "text-success bg-success/10", lost: "text-destructive bg-destructive/10",
  negotiation: "text-amber-600 bg-amber-100 dark:bg-amber-900/20",
  proposal: "text-violet-600 bg-violet-100 dark:bg-violet-900/20",
  qualified: "text-blue-600 bg-blue-100 dark:bg-blue-900/20",
  lead: "text-slate-600 bg-slate-100 dark:bg-slate-800/50",
};

function NpsGauge({ score }: { score: number }) {
  const color = score >= 8 ? "text-success" : score >= 6 ? "text-warning" : "text-destructive";
  const label = score >= 9 ? "Promoter" : score >= 7 ? "Passive" : "Detractor";
  return (
    <div className="flex items-center gap-3">
      <div className={cn("text-3xl font-bold", color)}>{score}</div>
      <div>
        <p className="text-xs text-muted-foreground">NPS Score</p>
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
  const [tab, setTab] = React.useState<Tab>("overview");
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  const del = useDeleteCustomer();

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
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />{status.label}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", tier.color, tier.bg)}>
                      {tier.icon} {tier.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{customer.industry}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onEdit?.(customer)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Quick metrics */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                { label: "Total Revenue", value: formatCurrency(customer.totalRevenue, customer.currency), sub: "Lifetime" },
                { label: "Open Deals",   value: customer.openDeals, sub: "Active" },
                { label: "Customer Since", value: new Date(customer.since).getFullYear(), sub: formatDate(customer.since, "medium") },
              ].map(m => (
                <div key={m.label} className="px-5 py-3 text-center">
                  <p className="font-bold text-base">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview","contacts","deals","activity"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
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
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Information</h4>
                    <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                      {[
                        { icon: Globe,    label: "Website",    value: customer.website ? <a href={`https://${customer.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{customer.website}</a> : "—" },
                        { icon: Phone,    label: "Phone",      value: customer.phone },
                        { icon: Mail,     label: "Email",      value: <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email}</a> },
                        { icon: MapPin,   label: "Location",   value: `${customer.city}, ${customer.country}` },
                        { icon: Building2,label: "Employees",  value: customer.employees ?? "—" },
                        { icon: User,     label: "Acc. Manager", value: customer.accountManager },
                        { icon: Calendar, label: "Last Activity", value: customer.lastActivity ? formatDate(customer.lastActivity, "medium") : "—" },
                        { icon: Calendar, label: "Contract Renewal", value: customer.contractRenewal ? formatDate(customer.contractRenewal, "medium") : "—" },
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
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer Satisfaction</h4>
                      <div className="bg-muted/30 rounded-xl p-4">
                        <NpsGauge score={customer.npsScore} />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {customer.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {customer.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
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
                    <h4 className="text-sm font-semibold">Deals ({customer.deals.length})</h4>
                    <Button size="sm" className="h-8 text-xs gap-1.5"><DollarSign className="h-3.5 w-3.5" />New Deal</Button>
                  </div>
                  {customer.deals.map((deal, i) => {
                    const statusColor = DEAL_STATUS_COLORS[deal.status] ?? "text-muted-foreground bg-muted";
                    return (
                      <motion.div key={deal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{deal.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", statusColor)}>{deal.status}</span>
                            {deal.closedDate && <span className="text-[11px] text-muted-foreground">{formatDate(deal.closedDate, "medium")}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(deal.value, deal.currency)}</p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ACTIVITY */}
              {tab === "activity" && (
                <div className="p-6">
                  <ActivityTimeline relatedToType="customer" relatedToId={customer.id} relatedToName={customer.name} assignedTo={customer.accountManager} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              <Button size="sm" className="gap-1.5 h-9" onClick={() => setTab("activity")}><MessageSquare className="h-3.5 w-3.5" />Log Activity</Button>
              <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:bg-destructive/5 ml-auto" disabled={del.isPending}
                onClick={() => { if (confirm(`Delete customer "${customer.name}"?`)) del.mutate(customer.id, { onSuccess: onClose }); }}>
                <Trash2 className="h-3.5 w-3.5" />Delete
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

