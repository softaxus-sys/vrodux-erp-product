"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Star, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, Target,
  BarChart3, ChevronRight, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { usePerformanceReviews, usePerformanceReview, useStartReview } from "@/hooks/hr/use-performance";
import type { PerformanceReviewSummaryDto } from "@/lib/hr/performance.api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:     { label: "Pending",     color: "text-muted-foreground", bg: "bg-muted",          icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20", icon: TrendingUp },
  completed:   { label: "Completed",   color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  overdue:     { label: "Overdue",     color: "text-destructive",      bg: "bg-destructive/10", icon: AlertTriangle },
};

const GOAL_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  on_track: { color: "text-success",     bg: "bg-success/10",     label: "On Track" },
  at_risk:  { color: "text-warning",     bg: "bg-warning/10",     label: "At Risk" },
  achieved: { color: "text-primary",     bg: "bg-primary/10",     label: "Achieved" },
  missed:   { color: "text-destructive", bg: "bg-destructive/10", label: "Missed" },
};

const REVIEW_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Review", mid_year: "Mid-Year", probation: "Probation Review", pip: "PIP",
};

function RatingStars({ rating, size = "sm" }: { rating?: number | null; size?: "sm" | "lg" }) {
  const s = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn(s, i <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
      ))}
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value?: number | null }) {
  if (!value) return null;
  const pct   = (value / 5) * 100;
  const color = value >= 4 ? "bg-success" : value >= 3 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}/5</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReviewDrawer({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const { data: review, isLoading } = usePerformanceReview(reviewId);
  const startReview = useStartReview();
  const [tab, setTab] = React.useState<"overview" | "goals">("overview");

  const sc = review ? (STATUS_CONFIG[review.status] ?? { label: review.status, color: "text-foreground", bg: "bg-muted", icon: Clock }) : null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">Performance Review</p>
          <div className="flex items-center gap-2">
            {review && review.status === "pending" && (
              <Button size="sm" className="h-8 text-xs" disabled={startReview.isPending}
                onClick={() => startReview.mutate(review.id)}>
                Start Review
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading || !review || !sc ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : (
          <>
            <div className="flex border-b border-border px-6">
              {(["overview", "goals"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t === "overview" ? "Overview" : `Goals (${review.goals.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {tab === "overview" && (
                <>
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{getInitials(review.employeeName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-base">{review.employeeName}</p>
                      {review.designation && <p className="text-sm text-muted-foreground">{review.designation}</p>}
                      {review.department && <p className="text-xs text-muted-foreground">{review.department}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Period",      value: review.reviewPeriod },
                      { label: "Type",        value: REVIEW_TYPE_LABELS[review.reviewType] ?? review.reviewType },
                      { label: "Due Date",    value: formatDate(review.dueDate, "medium") },
                      { label: "Reviewed By", value: review.reviewedBy ?? "—" },
                    ].map(item => (
                      <div key={item.label} className="bg-muted/30 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="text-sm font-semibold">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                  </div>

                  {review.overallRating && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-2">Overall Rating</p>
                      <RatingStars rating={review.overallRating} size="lg" />
                      <p className="text-2xl font-bold mt-2">{review.overallRating}<span className="text-sm text-muted-foreground">/5</span></p>
                    </div>
                  )}

                  {(review.technicalRating || review.communicationRating || review.teamworkRating || review.leadershipRating) && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category Ratings</h4>
                      <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                        <RatingBar label="Technical Skills"   value={review.technicalRating} />
                        <RatingBar label="Communication"      value={review.communicationRating} />
                        <RatingBar label="Teamwork"           value={review.teamworkRating} />
                        <RatingBar label="Leadership"         value={review.leadershipRating} />
                      </div>
                    </div>
                  )}

                  {review.strengths && (
                    <div>
                      <h4 className="text-xs font-semibold text-success uppercase tracking-wide mb-2">Strengths</h4>
                      <p className="text-sm text-muted-foreground bg-success/5 border border-success/20 rounded-xl p-3 leading-relaxed">{review.strengths}</p>
                    </div>
                  )}
                  {review.improvements && (
                    <div>
                      <h4 className="text-xs font-semibold text-warning uppercase tracking-wide mb-2">Areas for Improvement</h4>
                      <p className="text-sm text-muted-foreground bg-warning/5 border border-warning/20 rounded-xl p-3 leading-relaxed">{review.improvements}</p>
                    </div>
                  )}
                </>
              )}

              {tab === "goals" && (
                <div className="space-y-3">
                  {review.goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No goals defined.</p>
                  ) : review.goals.map((goal, i) => {
                    const gc = GOAL_STATUS_CONFIG[goal.status] ?? { color: "text-foreground", bg: "bg-muted", label: goal.status };
                    return (
                      <motion.div key={goal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }} className="bg-muted/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{goal.title}</p>
                          <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold", gc.color, gc.bg)}>{gc.label}</span>
                        </div>
                        {goal.target && <p className="text-xs text-muted-foreground">Target: {goal.target}</p>}
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span><span className="font-medium">{goal.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-border rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full",
                              goal.status === "achieved" ? "bg-primary" :
                              goal.status === "on_track" ? "bg-success" :
                              goal.status === "at_risk"  ? "bg-warning" : "bg-destructive")}
                              style={{ width: `${goal.progress}%` }} />
                          </div>
                        </div>
                        {goal.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />Due {formatDate(goal.dueDate, "medium")}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function PerformanceView() {
  const [search, setSearch]           = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage]               = React.useState(1);
  const [selectedId, setSelectedId]   = React.useState<string | null>(null);

  const { data, isLoading } = usePerformanceReviews({
    search:   search || undefined,
    status:   statusFilter !== "all" ? statusFilter : undefined,
    page,
    pageSize: 20,
  });

  const reviews    = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const completedCount   = reviews.filter(r => r.status === "completed").length;
  const inProgressCount  = reviews.filter(r => r.status === "in_progress").length;
  const pendingCount     = reviews.filter(r => r.status === "pending").length;
  const overdueCount     = reviews.filter(r => r.status === "overdue").length;
  const avgRating = reviews.filter(r => r.overallRating != null).length > 0
    ? (reviews.reduce((s, r) => s + (r.overallRating ?? 0), 0) / reviews.filter(r => r.overallRating != null).length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track reviews, ratings, and employee goals</p>
        </div>
        <Button size="sm" className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> New Review
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Reviews", value: totalCount,      color: "text-primary",     bg: "bg-primary/10",                     icon: BarChart3 },
          { label: "Completed",     value: completedCount,  color: "text-success",     bg: "bg-success/10",                     icon: CheckCircle2 },
          { label: "In Progress",   value: inProgressCount, color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    icon: TrendingUp },
          { label: "Pending",       value: pendingCount,    color: "text-muted-foreground", bg: "bg-muted",                    icon: Clock },
          { label: "Overdue",       value: overdueCount,    color: "text-destructive", bg: "bg-destructive/10",                 icon: AlertTriangle },
          { label: "Avg Rating",    value: avgRating === "—" ? "—" : `${avgRating}/5`, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20", icon: Star },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-lg leading-tight">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search employee or department…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "completed", "in_progress", "pending", "overdue"].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Employee","Review Period","Type","Due Date","Reviewed By","Overall Rating","Goals","Status",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">Loading…</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No reviews found.</td></tr>
            ) : reviews.map((rev: PerformanceReviewSummaryDto, i) => {
              const sc = STATUS_CONFIG[rev.status] ?? { label: rev.status, color: "text-foreground", bg: "bg-muted", icon: Clock };
              return (
                <motion.tr key={rev.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(rev.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(rev.employeeName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{rev.employeeName}</p>
                        {rev.department && <p className="text-[11px] text-muted-foreground">{rev.department}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{rev.reviewPeriod}</td>
                  <td className="px-4 py-3 text-sm">{REVIEW_TYPE_LABELS[rev.reviewType] ?? rev.reviewType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    <span className={cn(rev.status === "overdue" ? "text-destructive font-medium" : "")}>
                      {formatDate(rev.dueDate, "medium")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{rev.reviewedBy ?? "—"}</td>
                  <td className="px-4 py-3"><RatingStars rating={rev.overallRating} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{rev.goalCount} goals</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {selectedId && <ReviewDrawer reviewId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
