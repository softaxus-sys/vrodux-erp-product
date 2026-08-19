import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Star, TrendingUp,
  Clock, CheckCircle2, AlertTriangle, Target,
  BarChart3, User, ChevronRight, Award, Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { PerformanceReviewDto as PerformanceReview, ReviewStatus, Rating, PerformanceGoalDto } from "@/lib/hr/hr.api";
import {
  usePerformanceReviews, usePerformanceSummary,
  useStartPerformanceReview, useCompletePerformanceReview,
  useAddPerformanceGoal, useUpdatePerformanceGoal, useDeletePerformanceGoal,
} from "@/hooks/hr/use-hr";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddReviewForm } from "./add-review-form";
import { Can } from "@/components/auth/can";

const STATUS_CONFIG: Record<string, { key: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:     { key: "pending",     color: "text-muted-foreground", bg: "bg-muted",             icon: Clock },
  in_progress: { key: "in_progress", color: "text-info",             bg: "bg-info/10",           icon: TrendingUp },
  completed:   { key: "completed",   color: "text-success",          bg: "bg-success/10",        icon: CheckCircle2 },
  overdue:     { key: "overdue",     color: "text-destructive",      bg: "bg-destructive/10",    icon: AlertTriangle },
};
const STATUS_FALLBACK = { key: "unknown", color: "text-muted-foreground", bg: "bg-muted", icon: Clock };

const GOAL_STATUS_CONFIG: Record<string, { key: string; color: string; bg: string }> = {
  on_track: { key: "on_track", color: "text-success",     bg: "bg-success/10" },
  at_risk:  { key: "at_risk",  color: "text-warning",     bg: "bg-warning/10" },
  achieved: { key: "achieved", color: "text-primary",     bg: "bg-primary/10" },
  missed:   { key: "missed",   color: "text-destructive", bg: "bg-destructive/10" },
};
const GOAL_FALLBACK = { key: "unknown", color: "text-muted-foreground", bg: "bg-muted" };

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

function RatingSelector({ label, value, onChange }: { label: string; value: Rating | undefined; onChange: (v: Rating) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        {([1,2,3,4,5] as Rating[]).map(i => (
          <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5">
            <Star className={cn("h-4 w-4", value && i <= value ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
          </button>
        ))}
      </div>
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

const GOAL_STATUSES: PerformanceGoalDto["status"][] = ["on_track", "at_risk", "achieved", "missed"];

function GoalCard({ reviewId, goal, index }: { reviewId: string; goal: PerformanceGoalDto; index: number }) {
  const { t } = useTranslation("hr");
  const [editing, setEditing] = React.useState(false);
  const [progress, setProgress] = React.useState(goal.progress);
  const [status, setStatus] = React.useState<PerformanceGoalDto["status"]>(goal.status);

  const updateGoal = useUpdatePerformanceGoal();
  const deleteGoal = useDeletePerformanceGoal();

  const gc = GOAL_STATUS_CONFIG[goal.status] ?? GOAL_FALLBACK;

  const handleSave = async () => {
    try {
      await updateGoal.mutateAsync({ id: reviewId, goalId: goal.id, payload: { progress, status } });
      setEditing(false);
    } catch {
      // onError in hook shows the toast
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-muted/30 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{goal.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", gc.color, gc.bg)}>{t(`goalStatus.${gc.key}`)}</span>}
          <button onClick={() => deleteGoal.mutate({ id: reviewId, goalId: goal.id })} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("performance.drawer.target", { target: goal.target })}</p>

      {editing ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={progress}
              onChange={e => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="h-8 text-sm w-24" />
            <span className="text-xs text-muted-foreground">%</span>
            <select value={status} onChange={e => setStatus(e.target.value as PerformanceGoalDto["status"])}
              className="flex-1 h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              {GOAL_STATUSES.map(s => <option key={s} value={s}>{t(`goalStatus.${(GOAL_STATUS_CONFIG[s] ?? GOAL_FALLBACK).key}`)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>{t("performance.drawer.cancel")}</Button>
            <Button size="sm" className="h-7 text-xs" disabled={updateGoal.isPending} onClick={handleSave}>{t("performance.drawer.save")}</Button>
          </div>
        </div>
      ) : (
        <div onClick={() => setEditing(true)} className="cursor-pointer">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("performance.drawer.progress")}</span><span className="font-medium">{goal.progress}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full", goal.status === "achieved" ? "bg-primary" : goal.status === "on_track" ? "bg-success" : goal.status === "at_risk" ? "bg-warning" : "bg-destructive")}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />{t("performance.drawer.due", { date: formatDate(goal.dueDate, "medium") })}
      </div>
    </motion.div>
  );
}

function AddGoalForm({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const { t } = useTranslation("hr");
  const [title, setTitle] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  const addGoal = useAddPerformanceGoal();
  const isValid = title.trim() && target.trim() && dueDate;

  const handleAdd = async () => {
    if (!isValid) return;
    try {
      await addGoal.mutateAsync({ id: reviewId, payload: { title: title.trim(), target: target.trim(), dueDate } });
      onDone();
    } catch {
      // onError in hook shows the toast
    }
  };

  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-2.5">
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("performance.drawer.goalTitlePlaceholder")} className="h-8 text-sm" />
      <Input value={target} onChange={e => setTarget(e.target.value)} placeholder={t("performance.drawer.goalTargetPlaceholder")} className="h-8 text-sm" />
      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>{t("performance.drawer.cancel")}</Button>
        <Button size="sm" className="h-7 text-xs" disabled={!isValid || addGoal.isPending} onClick={handleAdd}>{t("performance.drawer.addGoal")}</Button>
      </div>
    </div>
  );
}

function ReviewDrawer({ review, open, onClose }: { review: PerformanceReview | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const [tab, setTab] = React.useState<"overview" | "goals">("overview");
  const [completing, setCompleting] = React.useState(false);
  const [overallRating, setOverallRating] = React.useState<Rating | undefined>();
  const [technicalRating, setTechnicalRating] = React.useState<Rating | undefined>();
  const [communicationRating, setCommunicationRating] = React.useState<Rating | undefined>();
  const [teamworkRating, setTeamworkRating] = React.useState<Rating | undefined>();
  const [leadershipRating, setLeadershipRating] = React.useState<Rating | undefined>();
  const [strengths, setStrengths] = React.useState("");
  const [improvements, setImprovements] = React.useState("");
  const [addingGoal, setAddingGoal] = React.useState(false);

  const startReview = useStartPerformanceReview();
  const completeReview = useCompletePerformanceReview();

  React.useEffect(() => {
    if (!open) {
      setCompleting(false);
      setOverallRating(undefined); setTechnicalRating(undefined); setCommunicationRating(undefined);
      setTeamworkRating(undefined); setLeadershipRating(undefined);
      setStrengths(""); setImprovements("");
      setAddingGoal(false);
    }
  }, [open]);

  if (!review) return null;
  const sc = STATUS_CONFIG[review.status] ?? STATUS_FALLBACK;

  const handleComplete = async () => {
    try {
      await completeReview.mutateAsync({
        id: review.id,
        payload: {
          overallRating, technicalRating, communicationRating, teamworkRating, leadershipRating,
          strengths: strengths.trim() || undefined,
          improvements: improvements.trim() || undefined,
        },
      });
      setCompleting(false);
    } catch {
      // onError in hook shows the toast
    }
  };

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
              <p className="font-bold text-base">{t("performance.drawer.title")}</p>
              <div className="flex items-center gap-2">
                {review.status === "pending" && (
                  <Button size="sm" className="h-8 text-xs" disabled={startReview.isPending}
                    onClick={() => startReview.mutate(review.id)}>
                    {t("performance.drawer.startReview")}
                  </Button>
                )}
                {review.status === "in_progress" && !completing && (
                  <Button size="sm" className="h-8 text-xs" onClick={() => setCompleting(true)}>
                    {t("performance.drawer.completeReview")}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
              {(["overview","goals"] as const).map(tk => (
                <button key={tk} onClick={() => setTab(tk)}
                  className={cn("px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === tk ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t(`performance.drawer.tab.${tk}`)}
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
                      <p className="text-xs text-muted-foreground mb-1">{t("performance.drawer.period")}</p>
                      <p className="text-sm font-semibold">{review.reviewPeriod}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("performance.drawer.type")}</p>
                      <p className="text-sm font-semibold">{t(`reviewType.${review.reviewType}`, { defaultValue: review.reviewType })}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("performance.drawer.dueDate")}</p>
                      <p className="text-sm font-semibold">{formatDate(review.dueDate, "medium")}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("performance.drawer.reviewedBy")}</p>
                      <p className="text-sm font-semibold truncate">{review.reviewedBy}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <span className="text-sm text-muted-foreground">{t("performance.drawer.status")}</span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <sc.icon className="h-3 w-3" />{t(`reviewStatus.${sc.key}`)}
                    </span>
                  </div>

                  {/* Complete review form */}
                  {completing && (
                    <div className="space-y-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide">{t("performance.drawer.completeReview")}</h4>
                      <div className="space-y-2.5">
                        <RatingSelector label={t("performance.drawer.overallRating")} value={overallRating} onChange={setOverallRating} />
                        <RatingSelector label={t("performance.drawer.technicalSkills")} value={technicalRating} onChange={setTechnicalRating} />
                        <RatingSelector label={t("performance.drawer.communication")} value={communicationRating} onChange={setCommunicationRating} />
                        <RatingSelector label={t("performance.drawer.teamwork")} value={teamworkRating} onChange={setTeamworkRating} />
                        <RatingSelector label={t("performance.drawer.leadership")} value={leadershipRating} onChange={setLeadershipRating} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.drawer.strengths")}</label>
                        <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2}
                          placeholder={t("performance.drawer.strengthsPlaceholder")}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.drawer.areasForImprovement")}</label>
                        <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2}
                          placeholder={t("performance.drawer.improvementsPlaceholder")}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setCompleting(false)}>{t("performance.drawer.cancel")}</Button>
                        <Button size="sm" disabled={!overallRating || completeReview.isPending} onClick={handleComplete}>
                          {completeReview.isPending ? t("performance.drawer.submitting") : t("performance.drawer.submitReview")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Overall rating */}
                  {review.overallRating && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-2">{t("performance.drawer.overallRating")}</p>
                      <RatingStars rating={review.overallRating} size="lg" />
                      <p className="text-2xl font-bold mt-2">{review.overallRating}<span className="text-sm text-muted-foreground">/5</span></p>
                    </div>
                  )}

                  {/* Category ratings */}
                  {(review.technicalRating || review.communicationRating) && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.drawer.categoryRatings")}</h4>
                      <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                        <RatingBar label={t("performance.drawer.technicalSkills")} value={review.technicalRating} />
                        <RatingBar label={t("performance.drawer.communication")} value={review.communicationRating} />
                        <RatingBar label={t("performance.drawer.teamwork")} value={review.teamworkRating} />
                        <RatingBar label={t("performance.drawer.leadership")} value={review.leadershipRating} />
                      </div>
                    </div>
                  )}

                  {/* Strengths / Improvements */}
                  {review.strengths && (
                    <div>
                      <h4 className="text-xs font-semibold text-success uppercase tracking-wide mb-2">{t("performance.drawer.strengths")}</h4>
                      <p className="text-sm text-muted-foreground bg-success/5 border border-success/20 rounded-xl p-3 leading-relaxed">{review.strengths}</p>
                    </div>
                  )}
                  {review.improvements && (
                    <div>
                      <h4 className="text-xs font-semibold text-warning uppercase tracking-wide mb-2">{t("performance.drawer.areasForImprovement")}</h4>
                      <p className="text-sm text-muted-foreground bg-warning/5 border border-warning/20 rounded-xl p-3 leading-relaxed">{review.improvements}</p>
                    </div>
                  )}
                </>
              )}

              {tab === "goals" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{t("performance.drawer.goalsTitle", { count: (review.goals ?? []).length })}</h4>
                    {!addingGoal && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingGoal(true)}>
                        <Plus className="h-3 w-3" />{t("performance.drawer.addGoal")}
                      </Button>
                    )}
                  </div>
                  {addingGoal && <AddGoalForm reviewId={review.id} onDone={() => setAddingGoal(false)} />}
                  {(review.goals ?? []).map((goal, i) => (
                    <GoalCard key={goal.id} reviewId={review.id} goal={goal} index={i} />
                  ))}
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
  const { t } = useTranslation("hr");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedReviewId, setSelectedReviewId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: performanceReviews = [] } = usePerformanceReviews();
  const { data: performanceSummary } = usePerformanceSummary();
  const selectedReview = performanceReviews.find(r => r.id === selectedReviewId) ?? null;

  const exportCsv = () => {
    const csv = toCsv(performanceReviews.map(r => ({
      "Employee":      r.employeeName,
      "Department":    r.department,
      "Designation":   r.designation,
      "Review Period": r.reviewPeriod,
      "Review Type":   r.reviewType,
      "Status":        r.status,
      "Overall Rating":r.overallRating ?? "",
      "Reviewed By":   r.reviewedBy,
      "Due Date":      r.dueDate,
      "Completed":     r.completedDate ?? "",
    })), ["Employee","Department","Designation","Review Period","Review Type","Status","Overall Rating","Reviewed By","Due Date","Completed"]);
    downloadFile(`performance_reviews_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Performance Reviews",
    subtitle: `${performanceReviews.length} reviews`,
    columns: ["Employee","Department","Review Period","Type","Status","Rating","Reviewed By","Due Date"],
    rows: performanceReviews.map(r => [r.employeeName, r.department, r.reviewPeriod, r.reviewType, r.status, r.overallRating ?? "—", r.reviewedBy, r.dueDate]),
    landscape: true,
  });

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
          <h1 className="text-2xl font-bold">{t("performance.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("performance.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="hr.performance.create"><Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />{t("performance.newReview")}</Button></Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: t("performance.stat.totalReviews"), value: performanceSummary?.totalReviews ?? performanceReviews.length,                                             color: "text-primary bg-primary/10",         icon: BarChart3 },
          { label: t("performance.stat.completed"),    value: performanceSummary?.completed    ?? performanceReviews.filter(r => r.status === "completed").length,    color: "text-success bg-success/10",         icon: CheckCircle2 },
          { label: t("performance.stat.inProgress"),   value: performanceSummary?.inProgress   ?? performanceReviews.filter(r => r.status === "in_progress").length,  color: "text-info bg-info/10",               icon: TrendingUp },
          { label: t("performance.stat.pending"),      value: performanceSummary?.pending      ?? performanceReviews.filter(r => r.status === "pending").length,      color: "text-muted-foreground bg-muted",     icon: Clock },
          { label: t("performance.stat.overdue"),      value: performanceSummary?.overdue      ?? performanceReviews.filter(r => r.status === "overdue").length,      color: "text-destructive bg-destructive/10", icon: AlertTriangle },
          { label: t("performance.stat.avgRating"),    value: `${performanceSummary?.avgRating ?? 0}/5`,                                                             color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20", icon: Star },
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
          <Input placeholder={t("performance.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {["all","completed","in_progress","pending","overdue"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {s === "all" ? t("performance.filterAll") : t(`reviewStatus.${s}`)}
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
                  {[
                    ["employee", t("performance.table.employee")], ["reviewPeriod", t("performance.table.reviewPeriod")],
                    ["type", t("performance.table.type")], ["dueDate", t("performance.table.dueDate")],
                    ["reviewedBy", t("performance.table.reviewedBy")], ["overallRating", t("performance.table.overallRating")],
                    ["goals", t("performance.table.goals")], ["status", t("performance.table.status")], ["actions", ""],
                  ].map(([k, h]) => (
                    <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">{t("performance.empty")}</td></tr>
                ) : filtered.map((rev, i) => {
                  const sc = STATUS_CONFIG[rev.status] ?? STATUS_FALLBACK;
                  const goals = rev.goals ?? [];
                  const goalsSummary = t("performance.onTrackSummary", { onTrack: goals.filter(g => g.status === "achieved" || g.status === "on_track").length, total: goals.length });
                  return (
                    <motion.tr key={rev.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer"
                      onClick={() => { setSelectedReviewId(rev.id); setDrawerOpen(true); }}>
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
                      <td className="px-4 py-3 text-sm">{t(`reviewType.${rev.reviewType}`, { defaultValue: rev.reviewType })}</td>
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
                          <sc.icon className="h-3 w-3" />{t(`reviewStatus.${sc.key}`)}
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
            {t("performance.showing", { shown: filtered.length, total: performanceReviews.length })}
          </div>
        </CardContent>
      </Card>

      <ReviewDrawer review={selectedReview} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddReviewForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

