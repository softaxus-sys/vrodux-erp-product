"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Building2, User, Mail, Phone, Calendar, DollarSign,
  Tag, Activity, MessageSquare, PhoneCall, Users, FileText,
  CheckSquare, TrendingUp, Edit, ArrowRight, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DealPriorityBadge } from "./deal-status-badge";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { PIPELINE_STAGES, type DealDto, type ActivityType } from "@/lib/crm/deals.api";

interface Props {
  deal: DealDto | null;
  open: boolean;
  onClose: () => void;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  call:    PhoneCall,
  email:   Mail,
  meeting: Users,
  note:    FileText,
  task:    CheckSquare,
};

const activityColors: Record<ActivityType, string> = {
  call:    "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
  email:   "bg-violet-100 text-violet-600 dark:bg-violet-900/30",
  meeting: "bg-green-100 text-green-600 dark:bg-green-900/30",
  note:    "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
  task:    "bg-pink-100 text-pink-600 dark:bg-pink-900/30",
};

const probabilityColor = (p: number) =>
  p >= 70 ? "text-success" : p >= 40 ? "text-warning" : "text-destructive";

type Tab = "overview" | "activities" | "contact";

export function DealDrawer({ deal, open, onClose }: Props) {
  const [tab, setTab] = React.useState<Tab>("overview");

  React.useEffect(() => { if (open) setTab("overview"); }, [open]);

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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Edit className="h-3.5 w-3.5" />Edit
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
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
                  Stage: <span className="font-semibold text-foreground">{PIPELINE_STAGES[currentStageIndex]?.label}</span>
                </span>
                <span className={cn("text-xs font-bold", probabilityColor(deal.probability))}>
                  {deal.probability}% probability
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview", "activities", "contact"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {t}
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
                      <p className="text-xs text-muted-foreground">Deal Value</p>
                      <p className="font-bold text-sm">{formatCurrency(deal.value, deal.currency)}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4 text-center">
                      <Calendar className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Close Date</p>
                      <p className="font-bold text-sm">{formatDate(deal.expectedCloseDate, "medium")}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4 text-center">
                      <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Win Chance</p>
                      <p className={cn("font-bold text-sm", probabilityColor(deal.probability))}>
                        {deal.probability}%
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{deal.description}</p>
                  </div>

                  {/* Details grid */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Deal Details</h4>
                    <div className="space-y-2.5">
                      {[
                        { label: "Priority",    value: <DealPriorityBadge priority={deal.priority} /> },
                        { label: "Source",      value: deal.source },
                        { label: "Industry",    value: deal.industry },
                        { label: "Assigned To", value: deal.assignedTo },
                        { label: "Created",     value: formatDate(deal.createdDate, "medium") },
                        { label: "Currency",    value: deal.currency },
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
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</h4>
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
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Next Action</span>
                      </div>
                      <p className="text-sm font-medium">{deal.nextAction}</p>
                      {deal.nextActionDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due: {formatDate(deal.nextActionDate, "medium")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Activities Tab */}
              {tab === "activities" && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">Activity Timeline</h4>
                    <Button size="sm" className="h-7 text-xs gap-1">
                      <Activity className="h-3 w-3" />Log Activity
                    </Button>
                  </div>

                  {deal.activities.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">No activities yet.</div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {[...deal.activities].reverse().map((activity, i) => {
                          const Icon = activityIcons[activity.type];
                          return (
                            <motion.div
                              key={activity.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex gap-4 relative"
                            >
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 z-10",
                                activityColors[activity.type]
                              )}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 bg-muted/30 rounded-xl p-3 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold leading-tight">{activity.title}</p>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatDate(activity.date, "medium")}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{activity.description}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1.5">by {activity.by}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Tab */}
              {tab === "contact" && (
                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Primary Contact</h4>
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                          {getInitials(deal.contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-base">{deal.contact.name}</p>
                        <p className="text-sm text-muted-foreground">{deal.contact.title}</p>
                        <p className="text-xs text-muted-foreground">{deal.company}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <a href={`mailto:${deal.contact.email}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{deal.contact.email}</p>
                        </div>
                      </a>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                          <Phone className="h-3.5 w-3.5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="text-sm font-medium">{deal.contact.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                          <Building2 className="h-3.5 w-3.5 text-info" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Company</p>
                          <p className="text-sm font-medium">{deal.company}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assigned rep */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account Owner</h4>
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {getInitials(deal.assignedTo)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{deal.assignedTo}</p>
                        <p className="text-xs text-muted-foreground">Account Executive</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border px-6 py-4 flex items-center gap-3">
              <Button size="sm" className="gap-1.5 h-9">
                <MessageSquare className="h-3.5 w-3.5" />Log Note
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <PhoneCall className="h-3.5 w-3.5" />Log Call
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Users className="h-3.5 w-3.5" />Schedule Meeting
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
