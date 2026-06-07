"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TASK_TYPES = [
  { value: "checkout",   label: "🏃 Checkout",    desc: "Full clean after guest departure" },
  { value: "stayover",   label: "🛏️ Stayover",    desc: "Daily refresh for occupied room" },
  { value: "deep_clean", label: "🧹 Deep Clean",  desc: "Thorough deep cleaning session" },
  { value: "inspection", label: "🔍 Inspection",  desc: "Quality inspection of room" },
  { value: "turndown",   label: "🌙 Turndown",    desc: "Evening turndown service" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "border-destructive bg-destructive/5 text-destructive" },
  { value: "high",   label: "High",   color: "border-warning bg-warning/5 text-warning" },
  { value: "normal", label: "Normal", color: "border-primary bg-primary/5 text-primary" },
  { value: "low",    label: "Low",    color: "border-border text-muted-foreground" },
];

const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  checkout:   ["Strip all bedding", "Clean bathroom", "Vacuum floors", "Dust surfaces", "Replace toiletries", "Check for damage", "Final inspection"],
  stayover:   ["Change towels", "Make bed", "Empty bins", "Replenish toiletries", "Tidy room"],
  deep_clean: ["Move furniture", "Deep vacuum", "Clean behind furniture", "Wash curtains", "Descale bathroom", "Polish surfaces"],
  inspection: ["Check linen quality", "Inspect bathroom fixtures", "Test all lights", "Check AC/heating", "Verify amenities"],
  turndown:   ["Turn down bed", "Place chocolates", "Close curtains", "Set alarm clock", "Dim lights"],
};

interface AddHKTaskFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddHKTaskForm({ open, onClose }: AddHKTaskFormProps) {
  const [taskType, setTaskType]     = React.useState("checkout");
  const [priority, setPriority]     = React.useState("normal");
  const [roomNumber, setRoomNumber] = React.useState("");
  const [floor, setFloor]           = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [estimatedMins, setEstimatedMins] = React.useState("45");
  const [checklist, setChecklist]   = React.useState<string[]>(DEFAULT_CHECKLISTS.checkout);
  const [notes, setNotes]           = React.useState("");

  const updateChecklist = (i: number, val: string) =>
    setChecklist(prev => prev.map((item, idx) => idx === i ? val : item));
  const removeItem = (i: number) => setChecklist(prev => prev.filter((_, idx) => idx !== i));
  const addItem = () => setChecklist(prev => [...prev, ""]);

  React.useEffect(() => {
    setChecklist([...DEFAULT_CHECKLISTS[taskType]]);
  }, [taskType]);

  const isValid = roomNumber.trim() && assignedTo.trim();

  const reset = () => {
    setTaskType("checkout"); setPriority("normal"); setRoomNumber(""); setFloor("");
    setAssignedTo(""); setScheduledTime(""); setEstimatedMins("45");
    setChecklist([...DEFAULT_CHECKLISTS.checkout]); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Housekeeping Task</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Assign a cleaning or inspection task</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Task Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Type</label>
                <div className="space-y-1.5">
                  {TASK_TYPES.map(t => (
                    <button key={t.value} onClick={() => setTaskType(t.value)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                        taskType === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                      <span className="text-base mt-0.5">{t.label.split(" ")[0]}</span>
                      <div>
                        <p className={`text-xs font-semibold ${taskType === t.value ? "text-primary" : "text-foreground"}`}>
                          {t.label.split(" ").slice(1).join(" ")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITIES.map(p => (
                    <button key={p.value} onClick={() => setPriority(p.value)}
                      className={`py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                        priority === p.value ? p.color : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Room & Assignment */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Assignment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Room Number *</label>
                    <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 201" className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Floor</label>
                    <Input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. 2" className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned To *</label>
                    <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Staff member name…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Time</label>
                    <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Est. Duration (min)</label>
                    <Input type="number" min={5} max={300} step={5} value={estimatedMins} onChange={e => setEstimatedMins(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist ({checklist.length} items)</label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                </div>
                <div className="space-y-1.5">
                  {checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                      <Input value={item} onChange={e => updateChecklist(i, e.target.value)} className="h-8 text-xs flex-1" />
                      <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions, guest preferences, hazards…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onClose} disabled={!isValid}>Create Task</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
