import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateJobPosting, useDepartments } from "@/hooks/hr/use-hr";
import { useCurrency } from "@/hooks/use-currency";

/** A stored value missing from the options would render the select blank — always offer it. */
function withCurrent(options: string[], current: string): string[] {
  const has = options.some(o => o.toLowerCase() === current.toLowerCase());
  return current && !has ? [current, ...options] : options;
}

const JOB_TYPES   = ["Full-Time", "Part-Time", "Contract", "Internship", "Freelance"];
const LOCATIONS    = ["Dubai HQ", "Abu Dhabi", "Sharjah", "Remote", "Hybrid"];
const EXPERIENCE_LEVELS = ["Entry Level", "Mid Level", "Senior Level", "Lead / Principal", "Director / VP", "C-Suite"];

const JOB_TYPE_MAP: Record<string, string> = {
  "Full-Time": "full_time", "Part-Time": "part_time", "Contract": "contract",
  "Internship": "internship", "Freelance": "freelance",
};

const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
  "Entry Level": "junior", "Mid Level": "mid", "Senior Level": "senior",
  "Lead / Principal": "lead", "Director / VP": "executive", "C-Suite": "executive",
};

interface AddJobPostingFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddJobPostingForm({ open, onClose }: AddJobPostingFormProps) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const { data: departments } = useDepartments();

  const [title, setTitle]               = React.useState("");
  const [department, setDepartment]     = React.useState("");
  const [jobType, setJobType]           = React.useState("Full-Time");
  const [location, setLocation]         = React.useState("Dubai HQ");
  const [experienceLevel, setExperience]= React.useState("Mid Level");
  const [headcount, setHeadcount]       = React.useState("1");
  const [salaryMin, setSalaryMin]       = React.useState("");
  const [salaryMax, setSalaryMax]       = React.useState("");
  const [closingDate, setClosingDate]   = React.useState("");
  const [hiringManager, setHiringManager] = React.useState("");
  const [description, setDescription]  = React.useState("");

  const departmentOptions = React.useMemo(
    () => withCurrent((departments ?? []).map(d => d.name).filter(Boolean), department),
    [departments, department]
  );
  const [requirements, setRequirements] = React.useState<string[]>(["", "", ""]);
  const [responsibilities, setResponsibilities] = React.useState<string[]>(["", "", ""]);

  const isValid = title.trim() && department && description.trim();

  const createJobPosting = useCreateJobPosting();

  const updateRequirement = (i: number, val: string) =>
    setRequirements(prev => prev.map((r, idx) => idx === i ? val : r));
  const updateResponsibility = (i: number, val: string) =>
    setResponsibilities(prev => prev.map((r, idx) => idx === i ? val : r));

  const reset = () => {
    setTitle(""); setDepartment(""); setJobType("Full-Time"); setLocation("Dubai HQ");
    setExperience("Mid Level"); setHeadcount("1"); setSalaryMin(""); setSalaryMax("");
    setClosingDate(""); setHiringManager(""); setDescription("");
    setRequirements(["", "", ""]); setResponsibilities(["", "", ""]);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async (status: "draft" | "open") => {
    try {
      await createJobPosting.mutateAsync({
        title: title.trim(),
        department,
        branch: location,
        type: JOB_TYPE_MAP[jobType] ?? "full_time",
        experienceLevel: EXPERIENCE_LEVEL_MAP[experienceLevel] ?? "mid",
        headcount: Number(headcount) || 1,
        salaryMin: Number(salaryMin) || 0,
        salaryMax: Number(salaryMax) || 0,
        currency,
        closingDate: closingDate || undefined,
        hiringManager: hiringManager.trim() || undefined,
        description: description.trim(),
        requirements: requirements.map(r => r.trim()).filter(Boolean),
        responsibilities: responsibilities.map(r => r.trim()).filter(Boolean),
        status,
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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("recruitment.jobForm.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("recruitment.jobForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recruitment.jobForm.basicInformation")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.jobTitle")}</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("recruitment.jobForm.jobTitlePlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.department")}</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("recruitment.jobForm.select")}</option>
                      {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.employmentType")}</label>
                    <select value={jobType} onChange={e => setJobType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.location")}</label>
                    <select value={location} onChange={e => setLocation(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.experienceLevel")}</label>
                    <select value={experienceLevel} onChange={e => setExperience(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.headcount")}</label>
                    <Input type="number" min={1} value={headcount} onChange={e => setHeadcount(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.closingDate")}</label>
                    <Input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.hiringManager")}</label>
                    <Input value={hiringManager} onChange={e => setHiringManager(e.target.value)} placeholder={t("recruitment.jobForm.hiringManagerPlaceholder")} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Salary Range */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recruitment.jobForm.salaryRange")}</p>
                <div className="flex items-center gap-2">
                  <span className="h-9 px-3 inline-flex items-center rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground shrink-0">
                    {currency}
                  </span>
                  <Input type="number" min={0} step={500} value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                    placeholder={t("recruitment.jobForm.min")} className="h-9 text-sm flex-1" />
                  <span className="text-muted-foreground text-sm">—</span>
                  <Input type="number" min={0} step={500} value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                    placeholder={t("recruitment.jobForm.max")} className="h-9 text-sm flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("recruitment.jobForm.perMonth")}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.jobDescription")}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={t("recruitment.jobForm.jobDescriptionPlaceholder")} rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Requirements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.requirements")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRequirements(p => [...p, ""])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("recruitment.jobForm.add")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {requirements.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <Input value={r} onChange={e => updateRequirement(i, e.target.value)}
                        placeholder={t("recruitment.jobForm.requirementPlaceholder")} className="h-8 text-xs flex-1" />
                      <button onClick={() => setRequirements(p => p.filter((_, idx) => idx !== i))}
                        disabled={requirements.length <= 1}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsibilities */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.jobForm.keyResponsibilities")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setResponsibilities(p => [...p, ""])} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> {t("recruitment.jobForm.add")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {responsibilities.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <Input value={r} onChange={e => updateResponsibility(i, e.target.value)}
                        placeholder={t("recruitment.jobForm.responsibilityPlaceholder")} className="h-8 text-xs flex-1" />
                      <button onClick={() => setResponsibilities(p => p.filter((_, idx) => idx !== i))}
                        disabled={responsibilities.length <= 1}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>{t("recruitment.jobForm.cancel")}</Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!isValid || createJobPosting.isPending}
                  onClick={() => handleSubmit("draft")}
                >
                  {t("recruitment.jobForm.saveAsDraft")}
                </Button>
                <Button
                  disabled={!isValid || createJobPosting.isPending}
                  onClick={() => handleSubmit("open")}
                >
                  {t("recruitment.jobForm.publishJob")}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

