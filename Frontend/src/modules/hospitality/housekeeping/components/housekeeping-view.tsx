"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, X, Zap, Clock, CheckCircle2, ClipboardList,
  User, Eye, ChevronRight, AlertTriangle, Shield,
} from "lucide-react";
import { useHKTasks, useUpdateHKTask } from "@/hooks/hospitality/use-hospitality";
import type { HKTaskDto as HKTask, HKStatus, TaskType, HKPriority } from "@/lib/hospitality/hospitality.api";
import { AddHKTaskForm } from "./add-hk-task-form";

const STATUS_CONFIG: Record<HKStatus, { label: string; color: string; bg: string; dot: string; border: string }> = {
  pending:     { label: "Pending",     color: "text-muted-foreground", bg: "bg-muted/30",   dot: "bg-muted-foreground", border: "border-border" },
  in_progress: { label: "In Progress", color: "text-warning",          bg: "bg-warning/10", dot: "bg-warning",          border: "border-warning/30" },
  completed:   { label: "Completed",   color: "text-success",          bg: "bg-success/10", dot: "bg-success",          border: "border-success/30" },
  inspected:   { label: "Inspected",   color: "text-primary",          bg: "bg-primary/10", dot: "bg-primary",          border: "border-primary/30" },
};

const PRIORITY_CONFIG: Record<HKPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgent", color: "text-destructive",      bg: "bg-destructive/10" },
  high:   { label: "High",   color: "text-warning",          bg: "bg-warning/10" },
  normal: { label: "Normal", color: "text-foreground",       bg: "bg-muted/30" },
  low:    { label: "Low",    color: "text-muted-foreground", bg: "bg-muted/20" },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; emoji: string }> = {
  checkout:   { label: "Checkout",    emoji: "🏃" },
  stayover:   { label: "Stayover",    emoji: "🛏️" },
  deep_clean: { label: "Deep Clean",  emoji: "🧹" },
  inspection: { label: "Inspection",  emoji: "🔍" },
  turndown:   { label: "Turndown",    emoji: "🌙" },
};

const STATUSES: HKStatus[] = ["pending", "in_progress", "completed", "inspected"];

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps { label: string; value: string | number; accent?: string; icon?: React.ReactNode }
function StatCard({ label, value, accent = "bg-primary", icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className={`w-1.5 h-1.5 rounded-full ${accent}`} />
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── HK Task Drawer ───────────────────────────────────────────────────────────
function HKDrawer({ task, onClose }: { task: HKTask; onClose: () => void }) {
  const updateTask = useUpdateHKTask();
  const statusCfg   = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const taskTypeCfg = TASK_TYPE_CONFIG[task.taskType];
  const done  = task.checklist.filter(c => c.done).length;
  const total = task.checklist.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{taskTypeCfg.emoji}</span>
              <p className="text-xs text-muted-foreground">{task.taskNumber}</p>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Room {task.roomNumber} — {taskTypeCfg.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Floor {task.floor} · {task.roomType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {task.priority === "urgent" && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${priorityCfg.bg} ${priorityCfg.color}`}>
                <Zap className="w-3 h-3" /> Urgent
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status + Priority */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            {task.priority !== "urgent" && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                {priorityCfg.label} Priority
              </span>
            )}
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <p className="text-xs font-medium text-warning">Note</p>
              </div>
              <p className="text-sm text-foreground">{task.notes}</p>
            </div>
          )}

          {/* Schedule & Staff */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Schedule & Assignment</p>
            <div className="space-y-2.5">
              {[
                { label: "Scheduled",    value: task.scheduledAt,           icon: Clock },
                { label: "Started",      value: task.startedAt ?? "Not started", icon: Clock },
                { label: "Completed",    value: task.completedAt ?? "—",    icon: CheckCircle2 },
                { label: "Assigned To",  value: task.assignedTo,            icon: User },
                { label: "Supervised By", value: task.supervisedBy,         icon: Shield },
                ...(task.inspectedBy ? [{ label: "Inspected By", value: task.inspectedBy, icon: Eye }] : []),
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <span className="text-xs font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist Progress */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Checklist — {done}/{total} ({pct}%)
            </p>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-1.5">
              {task.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${
                    item.done ? "bg-success border-success" : "border-border"
                  }`}>
                    {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-xs ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          {task.status === "pending" && (
            <Button className="flex-1" size="sm" disabled={updateTask.isPending}
              onClick={() => updateTask.mutate({ id: task.id, status: "in_progress" })}>
              Start Task
            </Button>
          )}
          {task.status === "in_progress" && (
            <Button className="flex-1" size="sm" disabled={updateTask.isPending}
              onClick={() => updateTask.mutate({ id: task.id, status: "completed" })}>
              Mark Complete
            </Button>
          )}
          {task.status === "completed" && (
            <Button className="flex-1" size="sm" disabled={updateTask.isPending}
              onClick={() => updateTask.mutate({ id: task.id, status: "inspected" })}>
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Mark Inspected
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onClick }: { task: HKTask; onClick: () => void }) {
  const statusCfg   = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const taskTypeCfg = TASK_TYPE_CONFIG[task.taskType];
  const done  = task.checklist.filter(c => c.done).length;
  const total = task.checklist.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <motion.tr
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {task.priority === "urgent" && <Zap className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
          <p className="text-xs font-mono text-muted-foreground">{task.taskNumber}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Room {task.roomNumber}</p>
        <p className="text-xs text-muted-foreground">Floor {task.floor} · {task.roomType}</p>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm">{taskTypeCfg.emoji} {taskTypeCfg.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
          {priorityCfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-foreground">{task.assignedTo}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-foreground">{task.scheduledAt}</p>
      </td>
      <td className="px-4 py-3 min-w-[100px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </motion.tr>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function HousekeepingView() {
  const [search, setSearch]       = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter]     = React.useState("all");
  const [selectedTask, setSelectedTask] = React.useState<HKTask | null>(null);
  const [showAddForm, setShowAddForm]   = React.useState(false);

  const { data: tasks = [], isLoading } = useHKTasks();

  const totalCount      = tasks.length;
  const pendingCount    = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount  = tasks.filter(t => t.status === "completed").length;
  const inspectedCount  = tasks.filter(t => t.status === "inspected").length;
  const urgentCount     = tasks.filter(t => t.priority === "urgent").length;
  const checkoutsCount  = tasks.filter(t => t.taskType === "checkout").length;
  const stayoversCount  = tasks.filter(t => t.taskType === "stayover").length;

  const filtered = React.useMemo(() => {
    return tasks.filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        t.taskNumber.toLowerCase().includes(q) ||
        t.roomNumber.includes(q) ||
        t.assignedTo.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchType   = typeFilter === "all" || t.taskType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [tasks, search, statusFilter, typeFilter]);

  const taskTypeOptions = [
    { value: "all",        label: "All Types" },
    { value: "checkout",   label: "🏃 Checkout" },
    { value: "stayover",   label: "🛏️ Stayover" },
    { value: "deep_clean", label: "🧹 Deep Clean" },
    { value: "inspection", label: "🔍 Inspection" },
    { value: "turndown",   label: "🌙 Turndown" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold text-foreground">Housekeeping</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Today's tasks — {totalCount} total · {urgentCount} urgent
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> New Task
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Tasks"  value={totalCount}      accent="bg-primary" />
          <StatCard label="Pending"      value={pendingCount}    accent="bg-muted-foreground" />
          <StatCard label="In Progress"  value={inProgressCount} accent="bg-warning" />
          <StatCard label="Completed"    value={completedCount}  accent="bg-success" />
          <StatCard label="Inspected"    value={inspectedCount}  accent="bg-primary" />
          <StatCard label="Urgent"       value={urgentCount}     accent="bg-destructive"
            icon={<Zap className="w-3.5 h-3.5 text-destructive" />} />
          <StatCard label="Checkouts"    value={checkoutsCount}  accent="bg-warning" />
          <StatCard label="Stayovers"    value={stayoversCount}  accent="bg-blue-500" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52 max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks, rooms, staff…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {[{ value: "all", label: "All" }, ...STATUSES.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Task type filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {taskTypeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Task #", "Room", "Type", "Status", "Priority", "Assigned To", "Scheduled", "Progress", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No tasks match your filters</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(task => (
                    <TaskRow key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <HKDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>
      <AddHKTaskForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
