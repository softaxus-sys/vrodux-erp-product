import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmployees } from "@/hooks/hr/use-hr";
import { useCreatePerformanceReview } from "@/hooks/hr/use-hr";
import type { PerformanceReviewDto } from "@/lib/hr/hr.api";

const REVIEW_TYPE_VALUES: PerformanceReviewDto["reviewType"][] = ["annual", "mid_year", "probation", "pip"];

const TODAY = new Date();
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
  const { t } = useTranslation("hr");
  const defaultPeriod = t("performance.form.defaultPeriod", { year: TODAY.getFullYear() });
  const [employeeId, setEmployeeId] = React.useState("");
  const [reviewPeriod, setReviewPeriod] = React.useState(defaultPeriod);
  const [reviewType, setReviewType] = React.useState<PerformanceReviewDto["reviewType"]>("annual");
  const [dueDate, setDueDate] = React.useState(DEFAULT_DUE_DATE);
  const [reviewedBy, setReviewedBy] = React.useState("");

  const { data: employees = [] } = useEmployees();
  const createReview = useCreatePerformanceReview();

  const isValid = employeeId && reviewPeriod.trim() && dueDate && reviewedBy.trim();

  const reset = () => {
    setEmployeeId(""); setReviewPeriod(defaultPeriod); setReviewType("annual");
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
                <h2 className="text-base font-bold text-foreground">{t("performance.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("performance.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.form.employee")}</label>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{t("performance.form.selectEmployee")}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} — {emp.designation || emp.department}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.form.reviewType")}</label>
                <select value={reviewType} onChange={e => setReviewType(e.target.value as PerformanceReviewDto["reviewType"])}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {REVIEW_TYPE_VALUES.map(v => <option key={v} value={v}>{t(`reviewType.${v}`)}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.form.reviewPeriod")}</label>
                <Input value={reviewPeriod} onChange={e => setReviewPeriod(e.target.value)} placeholder={t("performance.form.reviewPeriodPlaceholder")} className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.form.dueDate")}</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("performance.form.reviewedBy")}</label>
                <Input value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} placeholder={t("performance.form.reviewedByPlaceholder")} className="h-9 text-sm" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={onClose}>{t("performance.form.cancel")}</Button>
              <Button disabled={!isValid || createReview.isPending} onClick={handleSubmit}>
                {createReview.isPending ? t("performance.form.creating") : t("performance.form.createReview")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
