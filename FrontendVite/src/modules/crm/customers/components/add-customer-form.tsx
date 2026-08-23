import * as React from "react";
import { useTranslation } from "react-i18next";
import { useAssignableByTeam, useDefaultAssignee, encodeAssignee, decodeAssignee } from "@/hooks/identity/use-assignable-by-team";
import { toast } from "sonner";
import { StagedDocumentPicker, uploadStagedDocuments } from "@/modules/crm/shared/components/staged-document-picker";
import type { StagedDocument } from "@/modules/crm/shared/components/staged-document-picker";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import type { CustomerDto } from "@/lib/crm/crm.api";

const CUSTOMER_TYPES   = ["Individual", "Company", "Government", "SME", "Enterprise"];
const TYPE_SLUG: Record<string, string> = {
  "Individual": "individual", "Company": "company", "Government": "government", "SME": "sme", "Enterprise": "enterprise",
};
const INDUSTRIES       = ["Real Estate", "Construction", "Technology", "Finance", "Healthcare", "Retail", "Hospitality", "Manufacturing", "Education", "Government", "Other"];
const PAYMENT_TERMS    = ["Net 15", "Net 30", "Net 45", "Net 60", "Cash on Delivery", "Advance"];

interface AddCustomerFormProps {
  open: boolean;
  onClose: () => void;
  editing?: CustomerDto | null;
}

export function AddCustomerForm({ open, onClose, editing }: AddCustomerFormProps) {
  const { t } = useTranslation("crm");
  const isEdit = !!editing;
  const [customerType, setCustomerType] = React.useState("Company");
  const [name, setName]                 = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [email, setEmail]               = React.useState("");
  const [phone, setPhone]               = React.useState("");
  const [industry, setIndustry]         = React.useState("");
  const [website, setWebsite]           = React.useState("");
  const [trn, setTrn]                   = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30");
  const [creditLimit, setCreditLimit]   = React.useState("");
  const currency = useCurrency();
  const [address, setAddress]           = React.useState("");
  const [city, setCity]                 = React.useState("Dubai");
  const [country, setCountry]           = React.useState("UAE");
  const [assignedTo, setAssignedTo]     = React.useState("");           // display name
  const [assignedToUserId, setAssignedToUserId] = React.useState("");   // owning user ("" = unassigned)
  const [assignedTeamId, setAssignedTeamId] = React.useState<string | null>(null); // team the account belongs to
  // See the deal form: the id is what the assigned-only / my-team tiers scope on.
  // Grouped by team so a multi-team manager can be filed to the right team (see Module 30).
  const { groups: assignableGroups, options: assignableUsers } = useAssignableByTeam(open);
  // Start on the creator + their team — see the lead form.
  const defaultAssignee = useDefaultAssignee(open);

  React.useEffect(() => {
    if (!open || editing) return;
    const { userId, teamId } = decodeAssignee(defaultAssignee.value);
    if (!userId) return;
    setAssignedToUserId(userId);
    setAssignedTeamId(teamId);
    setAssignedTo(assignableUsers.find(u => u.id === userId)?.fullName ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, defaultAssignee.value]);
  const [notes, setNotes]               = React.useState("");
  const [staged, setStaged]             = React.useState<StagedDocument[]>([]);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const saving = createCustomer.isPending || updateCustomer.isPending;
  const isValid = name.trim() && email.trim();

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name); setEmail(editing.email); setPhone(editing.phone);
      setIndustry(editing.industry); setWebsite(editing.website ?? "");
      setAddress(editing.address); setCity(editing.city); setCountry(editing.country);
      setAssignedTo(editing.accountManager); setAssignedToUserId(editing.accountManagerUserId ?? "");
      setAssignedTeamId(editing.teamId ?? null);
      setNotes(editing.description);
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!isValid) return;
    const description = [notes, contactPerson && `Contact: ${contactPerson}`, trn && `TRN: ${trn}`].filter(Boolean).join(" · ");
    if (isEdit && editing) {
      updateCustomer.mutate({ id: editing.id, data: {
        name: name.trim(), industry, country, city, address: address.trim(),
        phone: phone.trim(), email: email.trim(), status: editing.status, tier: editing.tier,
        accountManager: assignedTo.trim(), accountManagerUserId: assignedToUserId || null, teamId: assignedTeamId,
        description, website: website.trim() || null,
        tradeName: editing.tradeName ?? null, employees: editing.employees ?? null,
        npsScore: editing.npsScore ?? null, contractRenewal: editing.contractRenewal ?? null, tags: editing.tags,
      } }, { onSuccess: onClose });
    } else {
      createCustomer.mutate({
        name: name.trim(), industry, country, city, address: address.trim(),
        phone: phone.trim(), email: email.trim(), tier: "standard",
        accountManager: assignedTo.trim(), accountManagerUserId: assignedToUserId || null, teamId: assignedTeamId, description,
      }, {
        onSuccess: async (created: any) => {
          if (staged.length && created?.id) {
            const failed = await uploadStagedDocuments("customer", created.id, staged);
            if (failed > 0) toast.error(t("documents.someFailed", { defaultValue: "{{count}} document(s) could not be attached.", count: failed }));
          }
          onClose();
        },
      });
    }
  };

  const reset = () => {
    setStaged([]);
    setCustomerType("Company"); setName(""); setContactPerson(""); setEmail(""); setPhone("");
    setIndustry(""); setWebsite(""); setTrn(""); setPaymentTerms("Net 30"); setCreditLimit("");
    setAddress(""); setCity("Dubai"); setCountry("UAE"); setAssignedTo(""); setNotes("");
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
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{isEdit ? t("customerForm.editTitle") : t("customerForm.newTitle")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? t("customerForm.editSubtitle") : t("customerForm.newSubtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.customerType")}</label>
                <div className="flex gap-2 flex-wrap">
                  {CUSTOMER_TYPES.map(ct => (
                    <button key={ct} onClick={() => setCustomerType(ct)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        customerType === ct ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {t(`customerForm.type.${TYPE_SLUG[ct]}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("customerForm.basicInformation")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {customerType === "Individual" ? t("customerForm.fullName") : t("customerForm.companyName")}
                    </label>
                    <Input value={name} onChange={e => setName(e.target.value)}
                      placeholder={customerType === "Individual" ? t("customerForm.fullNamePlaceholder") : t("customerForm.companyNamePlaceholder")} className="h-9 text-sm" />
                  </div>
                  {customerType !== "Individual" && (
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.contactPerson")}</label>
                      <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder={t("customerForm.contactPersonPlaceholder")} className="h-9 text-sm" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.email")}</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.phone")}</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 XX XXX XXXX" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.industry")}</label>
                    <select value={industry} onChange={e => setIndustry(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("customerForm.select")}</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.website")}</label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.trn")}</label>
                    <Input value={trn} onChange={e => setTrn(e.target.value)} placeholder="100XXXXXXXXX003" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("customerForm.financialSettings")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.paymentTerms")}</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PAYMENT_TERMS.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.currency")}</label>
                    <div className="w-full h-9 px-3 inline-flex items-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground">
                      {currency}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.creditLimit", { currency })}</label>
                    <Input type="number" min={0} step={1000} value={creditLimit} onChange={e => setCreditLimit(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("customerForm.address")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.streetAddress")}</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder={t("customerForm.streetPlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.city")}</label>
                    <Input value={city} onChange={e => setCity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.country")}</label>
                    <Input value={country} onChange={e => setCountry(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Assign & Notes */}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.accountManager")}</label>
                  <select
                    value={assignedToUserId ? encodeAssignee(assignedToUserId, assignedTeamId) : ""}
                    onChange={e => {
                      const { userId, teamId } = decodeAssignee(e.target.value);
                      setAssignedToUserId(userId ?? "");
                      setAssignedTeamId(teamId);
                      setAssignedTo(assignableUsers.find(u => u.id === userId)?.fullName ?? "");
                    }}
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{t("customerForm.unassigned", { defaultValue: "Unassigned" })}</option>
                    {assignableGroups.map(g => (
                      <optgroup key={g.team} label={g.team}>
                        {/* Keyed AND valued by team + user — someone in two teams appears under each. */}
                        {g.members.map(u => (
                          <option key={`${g.team}-${u.id}`} value={encodeAssignee(u.id, u.teamId)}>
                            {u.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customerForm.notes")}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={t("customerForm.notesPlaceholder")} rows={2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
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
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("customerForm.cancel")}</Button>
              <Button onClick={handleSave} disabled={!isValid || saving}>
                {saving ? t("customerForm.saving") : isEdit ? t("customerForm.saveChanges") : t("customerForm.saveCustomer")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

