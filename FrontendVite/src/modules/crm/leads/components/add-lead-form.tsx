import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StagedDocumentPicker, uploadStagedDocuments } from "@/modules/crm/shared/components/staged-document-picker";
import type { StagedDocument } from "@/modules/crm/shared/components/staged-document-picker";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateLead, useUpdateLead } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import { useUsers } from "@/hooks/identity/use-users";
import { TIMEFRAME_OPTIONS, type LeadDto } from "@/lib/crm/crm.api";

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const LEAD_SOURCES = ["Website", "LinkedIn", "Referral", "Cold Call", "Email Campaign", "Trade Show", "Social Media", "Walk-In", "Partner", "Other"];
// "Visa Services" drives the Visa Case action in the lead drawer (see isVisaLead).
const INDUSTRIES   = ["Real Estate", "Construction", "Technology", "Finance", "Healthcare", "Retail", "Hospitality", "Manufacturing", "Education", "Government", "Visa Services", "Other"];
const LEAD_STAGES  = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation"];
const PRIORITIES   = ["Low", "Medium", "High", "Urgent"];

interface AddLeadFormProps {
  open: boolean;
  onClose: () => void;
  editing?: LeadDto | null;
}

export function AddLeadForm({ open, onClose, editing }: AddLeadFormProps) {
  const { t } = useTranslation("crm");
  const isEdit = !!editing;
  // Real tenant users this lead can be assigned to. The Identity /users endpoint is
  // tenant-scoped server-side (non-super-admins only get their own tenant's users);
  // here we further limit to active accounts so you can't assign to a disabled user.
  const { data: usersPage } = useUsers({ pageSize: 200 });
  const assignableUsers = (usersPage?.items ?? []).filter(u => u.status?.toLowerCase() === "active");
  const [firstName, setFirstName]     = React.useState("");
  const [lastName, setLastName]       = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [company, setCompany]         = React.useState("");
  const [jobTitle, setJobTitle]       = React.useState("");
  const [industry, setIndustry]       = React.useState("");
  const [source, setSource]           = React.useState("Website");
  const [stage, setStage]             = React.useState("New");
  const [priority, setPriority]       = React.useState("Medium");
  const [dealValue, setDealValue]     = React.useState("");
  const currency = useCurrency();
  const [assignedTo, setAssignedTo]   = React.useState("");           // display name
  const [assignedToUserId, setAssignedToUserId] = React.useState(""); // Identity user id ("" = unassigned)
  const [expectedClose, setExpectedClose] = React.useState("");
  const [notes, setNotes]             = React.useState("");
  const [staged, setStaged]           = React.useState<StagedDocument[]>([]);
  const [whatsApp, setWhatsApp]       = React.useState("");
  const [interestedIn, setInterestedIn] = React.useState("");
  const [budget, setBudget]           = React.useState("");
  const [message, setMessage]         = React.useState("");
  const [timeframe, setTimeframe]     = React.useState("");

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const saving = createLead.isPending || updateLead.isPending;
  const isValid = firstName.trim() && (email.trim() || phone.trim()) && source;

  // Prefill when editing
  React.useEffect(() => {
    if (open && editing) {
      setFirstName(editing.firstName); setLastName(editing.lastName); setEmail(editing.email);
      setPhone(editing.phone); setCompany(editing.company); setJobTitle(editing.title);
      setIndustry(editing.industry); setSource(titleCase(editing.source));
      setPriority(titleCase(editing.priority)); setDealValue(String(editing.estimatedValue || ""));
      setAssignedTo(editing.assignedTo); setAssignedToUserId(editing.assignedToUserId ?? ""); setNotes(editing.notes ?? "");
      setWhatsApp(editing.whatsApp ?? ""); setInterestedIn(editing.interestedIn ?? "");
      setBudget(editing.budget ?? ""); setMessage(editing.message ?? "");
      setTimeframe(editing.purchaseTimeframe ?? "");
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!isValid) return;
    const base = {
      firstName: firstName.trim(), lastName: lastName.trim(), title: jobTitle.trim(),
      company: company.trim(), industry, email: email.trim(), phone: phone.trim(),
      country: editing?.country ?? "", city: editing?.city ?? "",
      source: source.toLowerCase().replace(/\s+/g, "_"),
      priority: priority.toLowerCase(), estimatedValue: parseFloat(dealValue) || 0,
      assignedTo: assignedTo.trim(), assignedToUserId: assignedToUserId || null, notes: notes.trim() || null,
      whatsApp: whatsApp.trim() || null, interestedIn: interestedIn.trim() || null,
      budget: budget.trim() || null, message: message.trim() || null,
      purchaseTimeframe: timeframe.trim() || null,
    };
    if (isEdit && editing) {
      updateLead.mutate({ id: editing.id, data: { ...base, score: editing.score, nextFollowUp: editing.nextFollowUp ?? null, tags: editing.tags } }, { onSuccess: onClose });
    } else {
      createLead.mutate(base, {
        onSuccess: async (created: any) => {
          if (staged.length && created?.id) {
            const failed = await uploadStagedDocuments("lead", created.id, staged);
            if (failed > 0) toast.error(t("documents.someFailed", { defaultValue: "{{count}} document(s) could not be attached.", count: failed }));
          }
          onClose();
        },
      });
    }
  };

  const reset = () => {
    setStaged([]);
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setCompany(""); setJobTitle(""); setIndustry(""); setSource("Website");
    setStage("New"); setPriority("Medium"); setDealValue("");
    setAssignedTo(""); setAssignedToUserId(""); setExpectedClose(""); setNotes("");
    setWhatsApp(""); setInterestedIn(""); setBudget(""); setMessage(""); setTimeframe("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

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
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{isEdit ? t("form.editTitle") : t("form.newTitle")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? t("form.editSubtitle") : t("form.newSubtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Contact */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("form.contactInformation")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.firstName")}</label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t("form.firstNamePlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.lastName")}</label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t("form.lastNamePlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.email")}</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.phone")}</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.company")}</label>
                    <Input value={company} onChange={e => setCompany(e.target.value)} placeholder={t("form.companyPlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.jobTitle")}</label>
                    <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder={t("form.jobTitlePlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.industry")}</label>
                    <select value={industry} onChange={e => setIndustry(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("form.selectIndustry")}</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lead Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("form.leadDetails")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.leadSource")}</label>
                    <select value={source} onChange={e => setSource(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.stage")}</label>
                    <select value={stage} onChange={e => setStage(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.priority")}</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.expectedClose")}</label>
                    <Input type="date" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.dealValue")}</label>
                    <div className="flex gap-2">
                      <span className="h-9 px-3 inline-flex items-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground shrink-0">
                        {currency}
                      </span>
                      <Input type="number" min={0} step={1000} value={dealValue} onChange={e => setDealValue(e.target.value)}
                        placeholder="0.00" className="h-9 text-sm flex-1 text-right" />
                    </div>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.assignedTo")}</label>
                    <select value={assignedToUserId}
                      onChange={e => {
                        const id = e.target.value;
                        setAssignedToUserId(id);
                        setAssignedTo(assignableUsers.find(u => u.id === id)?.fullName ?? "");
                      }}
                      className="h-9 w-full px-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {/* Legacy leads carry only a name — surface it so it isn't silently lost. */}
                      <option value="">{assignedTo && !assignedToUserId ? t("form.unlinked", { name: assignedTo }) : t("form.unassigned")}</option>
                      {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">{t("form.assignedToHint")}</p>
                  </div>
                </div>
              </div>

              {/* Requirements — captured from lead-gen forms, editable here */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("form.requirements")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.whatsapp")}</label>
                    <Input value={whatsApp} onChange={e => setWhatsApp(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.budget")}</label>
                    <Input value={budget} onChange={e => setBudget(e.target.value)} placeholder={t("form.budgetPlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.planningToBuy")}</label>
                    <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("form.notSpecified")}</option>
                      {TIMEFRAME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <p className="text-[10px] text-muted-foreground">{t("form.timeframeHint")}</p>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.interestedIn")}</label>
                    <Input value={interestedIn} onChange={e => setInterestedIn(e.target.value)} placeholder={t("form.interestedInPlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.messageFromLead")}</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                      placeholder={t("form.messagePlaceholder")} rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              </div>


              {/* Documents — optional. Staged locally, uploaded once the record has an id. */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("documents.tab", { defaultValue: "Documents" })}
                  <span className="ml-1.5 normal-case font-normal text-muted-foreground/70">
                    {t("documents.optional", { defaultValue: "(optional)" })}
                  </span>
                </p>
                <StagedDocumentPicker files={staged} onChange={setStaged} />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("form.notesPlaceholder")} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("form.cancel")}</Button>
              <Button onClick={handleSave} disabled={!isValid || saving}>
                {saving ? t("form.saving") : isEdit ? t("form.saveChanges") : t("form.saveLead")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

