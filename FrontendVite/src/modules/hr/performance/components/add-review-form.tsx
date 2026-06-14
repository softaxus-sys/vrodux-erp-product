import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmployees } from "@/hooks/hr/use-hr";
import { useCreatePerformanceReview } from "@/hooks/hr/use-hr";
import type { PerformanceReviewDto } from "@/lib/hr/hr.api";

const REVIEW_TYPES: { value: PerformanceReviewDto["reviewType"]; label: string }[] = [
  { value: "annual",   label: "Annual Review" },
  { value: "mid_year", label: "Mid-Year Review" },
  { value: "probation",label: "Probation Review" },
  { value: "pip",      label: "PIP" },
];

const TODAY = new Date();
const DEFAULT_PERIOD = `Annual ${TODAY.getFullYear()}`;
const DEFAULT_DUE_DATE = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
})();

interface AddReviewFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddReviewForm({ open, onClose }: AddReviewFormProps) {
  const [employeeId, setEmployeeId] = React.useState("");
  const [reviewPeriod, setReviewPeriod] = React.useState(DEFAULT_PERIOD);
  const [reviewType, setReviewType] = React.useState<PerformanceReviewDto["reviewType"]>("annual");
  const [dueDate, setDueDate] = React.useState(DEFAULT_DUE_DATE);
  const [reviewedBy, setReviewedBy] = React.useState("");

  const { data: employees = [] } = useEmployees();
  const createReview = useCreatePerformanceReview();

  const isValid = employeeId && reviewPeriod.trim() && dueDate && reviewedBy.trim();

  const reset = () => {
    setEmployeeId(""); setReviewPeriod(DEFAULT_PERIOD); setReviewType("annual");
    setDueDate(DEFAULT_DUE_DATE); setReviewedBy("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await createReview.mutateAsync({
        employeeId,
        reviewPeriod: reviewPeriod.trim(),
        reviewType,
        dueDate,
        reviewedBy: reviewedBy.trim(),
      });
      onClose();
    } catch {
      // onError in hook shows the toast; drawer stays open for retry
    }
  };

  return (
    <AnimatePresence>
      {open && (
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Performance Review</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Schedule a review for an employee</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee *</label>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select employee…</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} — {emp.designation || emp.department}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review Type *</label>
                <select value={reviewType} onChange={e => setReviewType(e.target.value as PerformanceReviewDto["reviewType"])}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {REVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review Period *</label>
                <Input value={reviewPeriod} onChange={e => setReviewPeriod(e.target.value)} placeholder="e.g. Annual 2026, Q1 2026" className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date *</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reviewed By *</label>
                <Input value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} placeholder="e.g. Manager name" className="h-9 text-sm" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!isValid || createReview.isPending} onClick={handleSubmit}>
                {createReview.isPending ? "Creating…" : "Create Review"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
