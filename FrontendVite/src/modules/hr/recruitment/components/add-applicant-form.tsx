import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateApplicant } from "@/hooks/hr/use-hr";

const SOURCES = ["LinkedIn", "Company Website", "Referral", "Job Board", "Recruiter", "Other"];

interface AddApplicantFormProps {
  open: boolean;
  jobId: string | null;
  jobTitle?: string;
  onClose: () => void;
}

export function AddApplicantForm({ open, jobId, jobTitle, onClose }: AddApplicantFormProps) {
  const { t } = useTranslation("hr");
  const [name, setName]                     = React.useState("");
  const [email, setEmail]                   = React.useState("");
  const [phone, setPhone]                   = React.useState("");
  const [nationality, setNationality]       = React.useState("");
  const [currentRole, setCurrentRole]       = React.useState("");
  const [currentCompany, setCurrentCompany] = React.useState("");
  const [experience, setExperience]         = React.useState("0");
  const [source, setSource]                 = React.useState("LinkedIn");
  const [notes, setNotes]                   = React.useState("");

  const createApplicant = useCreateApplicant();

  const isValid = name.trim() && email.trim() && jobId;

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setNationality("");
    setCurrentRole(""); setCurrentCompany(""); setExperience("0");
    setSource("LinkedIn"); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!jobId) return;
    try {
      await createApplicant.mutateAsync({
        jobId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        nationality: nationality.trim() || undefined,
        currentRole: currentRole.trim() || undefined,
        currentCompany: currentCompany.trim() || undefined,
        experience: Number(experience) || 0,
        source: source || undefined,
        notes: notes.trim() || undefined,
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
                <h2 className="text-base font-bold text-foreground">{t("recruitment.applicantForm.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{jobTitle ? t("recruitment.applicantForm.applyingFor", { title: jobTitle }) : t("recruitment.applicantForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.fullName")}</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("recruitment.applicantForm.fullNamePlaceholder")} className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.email")}</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.phone")}</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 5x xxx xxxx" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.nationality")}</label>
                  <Input value={nationality} onChange={e => setNationality(e.target.value)} placeholder={t("recruitment.applicantForm.nationalityPlaceholder")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.currentRole")}</label>
                  <Input value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder={t("recruitment.applicantForm.currentRolePlaceholder")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.currentCompany")}</label>
                  <Input value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} placeholder={t("recruitment.applicantForm.currentCompanyPlaceholder")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.experienceYears")}</label>
                  <Input type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.source")}</label>
                  <select value={source} onChange={e => setSource(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.applicantForm.notes")}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={t("recruitment.applicantForm.notesPlaceholder")} rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={onClose}>{t("recruitment.applicantForm.cancel")}</Button>
              <Button disabled={!isValid || createApplicant.isPending} onClick={handleSubmit}>
                {createApplicant.isPending ? t("recruitment.applicantForm.adding") : t("recruitment.applicantForm.addApplicant")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
