import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Download, X, Star, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, Target,
  BarChart3, User, ChevronRight, Award
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { PerformanceReviewDto as PerformanceReview, ReviewStatus, Rating } from "@/lib/hr/hr.api";
import { usePerformanceReviews, usePerformanceSummary } from "@/hooks/hr/use-hr";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:     { label: "Pending",     color: "text-muted-foreground", bg: "bg-muted",             icon: Clock },
  in_progress: { label: "In Progress", color: "text-info",             bg: "bg-info/10",           icon: TrendingUp },
  completed:   { label: "Completed",   color: "text-success",          bg: "bg-success/10",        icon: CheckCircle2 },
  overdue:     { label: "Overdue",     color: "text-destructive",      bg: "bg-destructive/10",    icon: AlertTriangle },
};
const STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted", icon: Clock };

const GOAL_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  on_track: { color: "text-success",     bg: "bg-success/10",     label: "On Track" },
  at_risk:  { color: "text-warning",     bg: "bg-warning/10",     label: "At Risk" },
  achieved: { color: "text-primary",     bg: "bg-primary/10",     label: "Achieved" },
  missed:   { color: "text-destructive", bg: "bg-destructive/10", label: "Missed" },
};
const GOAL_FALLBACK = { color: "text-muted-foreground", bg: "bg-muted", label: "Unknown" };

const REVIEW_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Review", mid_year: "Mid-Year", probation: "Probation Review", pip: "PIP",
};

function RatingStars({ rating, size = "sm" }: { rating?: Rating; size?: "sm" | "lg" }) {
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

function RatingBar({ label, value }: { label: string; value?: Rating }) {
  if (!value) return null;
  const pct = (value / 5) * 100;
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

function ReviewDrawer({ review, open, onClose }: { review: PerformanceReview | null; open: boolean; onClose: () => void }) {
  const [tab, setTab] = React.useState<"overview" | "goals">("overview");
  if (!review) return null;
  const sc = STATUS_CONFIG[review.status] ?? STATUS_FALLBACK;
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <p className="font-bold text-base">Performance Review</p>
              <div className="flex items-center gap-2">
                {review.status !== "completed" && <Button size="sm" className="h-8 text-xs">Start Review</Button>}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview","goals"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-4 py-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t === "overview" ? "Overview" : "Goals & Objectives"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {tab === "overview" && (
                <>
                  {/* Employee */}
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{getInitials(review.employeeName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-base">{review.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{review.designation}</p>
                      <p className="text-xs text-muted-foreground">{review.department}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Period</p>
                      <p className="text-sm font-semibold">{review.reviewPeriod}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Type</p>
                      <p className="text-sm font-semibold">{REVIEW_TYPE_LABELS[review.reviewType] ?? review.reviewType}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                      <p className="text-sm font-semibold">{formatDate(review.dueDate, "medium")}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Reviewed By</p>
                      <p className="text-sm font-semibold truncate">{review.reviewedBy}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{sc.label}
                    </span>
                  </div>

                  {/* Overall rating */}
                  {review.overallRating && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-2">Overall Rating</p>
                      <RatingStars rating={review.overallRating} size="lg" />
                      <p className="text-2xl font-bold mt-2">{review.overallRating}<span className="text-sm text-muted-foreground">/5</span></p>
                    </div>
                  )}

                  {/* Category ratings */}
                  {(review.technicalRating || review.communicationRating) && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category Ratings</h4>
                      <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                        <RatingBar label="Technical Skills" value={review.technicalRating} />
                        <RatingBar label="Communication" value={review.communicationRating} />
                        <RatingBar label="Teamwork" value={review.teamworkRating} />
                        <RatingBar label="Leadership" value={review.leadershipRating} />
                      </div>
                    </div>
                  )}

                  {/* Strengths / Improvements */}
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
                  <h4 className="text-sm font-semibold">Goals & Objectives ({(review.goals ?? []).length})</h4>
                  {(review.goals ?? []).map((goal, i) => {
                    const gc = GOAL_STATUS_CONFIG[goal.status] ?? GOAL_FALLBACK;
                    return (
                      <motion.div key={goal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-muted/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{goal.title}</p>
                          <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold", gc.color, gc.bg)}>{gc.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Target: {goal.target}</p>
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span><span className="font-medium">{goal.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", goal.status === "achieved" ? "bg-primary" : goal.status === "on_track" ? "bg-success" : goal.status === "at_risk" ? "bg-warning" : "bg-destructive")}
                              style={{ width: `${goal.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />Due {formatDate(goal.dueDate, "medium")}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function PerformanceView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedReview, setSelectedReview] = React.useState<PerformanceReview | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const { data: performanceReviews = [] } = usePerformanceReviews();
  const { data: performanceSummary } = usePerformanceSummary();

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return performanceReviews.filter(r => {
      const matchSearch = !search || r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter, performanceReviews]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track reviews, ratings, and employee goals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm"><Download className="h-3.5 w-3.5" />Export</Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm"><Plus className="h-4 w-4" />New Review</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Reviews",  value: performanceSummary?.totalReviews ?? performanceReviews.length,                                             color: "text-primary bg-primary/10",         icon: BarChart3 },
          { label: "Completed",      value: performanceSummary?.completed    ?? performanceReviews.filter(r => r.status === "completed").length,    color: "text-success bg-success/10",         icon: CheckCircle2 },
          { label: "In Progress",    value: performanceSummary?.inProgress   ?? performanceReviews.filter(r => r.status === "in_progress").length,  color: "text-info bg-info/10",               icon: TrendingUp },
          { label: "Pending",        value: performanceSummary?.pending      ?? performanceReviews.filter(r => r.status === "pending").length,      color: "text-muted-foreground bg-muted",     icon: Clock },
          { label: "Overdue",        value: performanceSummary?.overdue      ?? performanceReviews.filter(r => r.status === "overdue").length,      color: "text-destructive bg-destructive/10", icon: AlertTriangle },
          { label: "Avg Rating",     value: `${performanceSummary?.avgRating ?? 0}/5`,                                                             color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20", icon: Star },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search employee or department..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {["all","completed","in_progress","pending","overdue"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30">
                <tr>
                  {["Employee","Review Period","Type","Due Date","Reviewed By","Overall Rating","Goals","Status",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">No reviews found.</td></tr>
                ) : filtered.map((rev, i) => {
                  const sc = STATUS_CONFIG[rev.status] ?? STATUS_FALLBACK;
                  const goals = rev.goals ?? [];
                  const goalsSummary = `${goals.filter(g => g.status === "achieved" || g.status === "on_track").length}/${goals.length} on track`;
                  return (
                    <motion.tr key={rev.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer"
                      onClick={() => { setSelectedReview(rev); setDrawerOpen(true); }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(rev.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{rev.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">{rev.department}</p>
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
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{rev.reviewedBy}</td>
                      <td className="px-4 py-3"><RatingStars rating={rev.overallRating} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{goalsSummary}</td>
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
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {performanceReviews.length} reviews
          </div>
        </CardContent>
      </Card>

      <ReviewDrawer review={selectedReview} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

