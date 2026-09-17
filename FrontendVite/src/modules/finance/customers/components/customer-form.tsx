import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/use-field-errors";
import { useAccounts, useCreateFinanceCustomer, useUpdateFinanceCustomer } from "@/hooks/finance/use-finance";
import type { FinanceCustomerDto } from "@/lib/finance/finance.api";

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the form runs in edit mode. */
  customer?: FinanceCustomerDto | null;
}

export function CustomerForm({ open, onClose, customer }: CustomerFormProps) {
  const { t } = useTranslation("finance");
  const isEdit = !!customer;
  const errors = useFieldErrors();

  const [name, setName]           = React.useState("");
  const [email, setEmail]         = React.useState("");
  const [phone, setPhone]         = React.useState("");
  const [address, setAddress]     = React.useState("");
  const [ccEmails, setCcEmails]   = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [isActive, setIsActive]   = React.useState(true);

  // Receivables sit on the asset side, so only asset accounts are valid here.
  const { data: accounts } = useAccounts({ accountType: "asset", isActive: true });

  const create = useCreateFinanceCustomer();
  const update = useUpdateFinanceCustomer();
  const isPending = create.isPending || update.isPending;

  const isValid = name.trim().length > 0;

  const reset = React.useCallback(() => {
    setName(""); setEmail(""); setPhone(""); setAddress(""); setCcEmails("");
    setAccountId(""); setIsActive(true);
    errors.clear();
  }, [errors]);

  // Seed from the record on open in edit mode; clear on close in create mode. Keyed on `open`
  // too, or reopening the drawer after a cancelled edit keeps the previous customer's values.
  React.useEffect(() => {
    if (!open) return;
    errors.clear();
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setPhone(customer.phone ?? "");
      setAddress(customer.address ?? "");
      setCcEmails(customer.ccEmails ?? "");
      setAccountId(customer.accountId ?? "");
      setIsActive(customer.isActive);
    } else {
      setName(""); setEmail(""); setPhone(""); setAddress(""); setCcEmails("");
      setAccountId(""); setIsActive(true);
    }
  }, [open, customer]);

  const handleClose = () => { reset(); onClose(); };

  async function handleSubmit() {
    errors.clear();
    const payload = {
      name:      name.trim(),
      email:     email.trim()   || undefined,
      phone:     phone.trim()   || undefined,
      address:   address.trim() || undefined,
      ccEmails:  ccEmails.trim() || undefined,
      accountId: accountId      || undefined,
      isActive,
    };

    try {
      if (isEdit && customer) {
        await update.mutateAsync({ id: customer.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      handleClose();
    } catch (e) {
      // Field-level messages land on the inputs; anything else is already toasted by the hook.
      errors.capture(e);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed end-0 top-0 h-full w-full max-w-xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isEdit ? t("customers.form.editTitle") : t("customers.form.title")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEdit ? t("customers.form.editSubtitle", { name: customer?.name }) : t("customers.form.subtitle")}
                </p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {errors.formError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-px shrink-0" />
                  <p className="text-xs text-destructive">{errors.formError}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("customers.form.details")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("customers.form.name")} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={e => { setName(e.target.value); errors.clearField("name"); }}
                      placeholder={t("customers.form.namePh")}
                      aria-invalid={!!errors.get("name")}
                      className="h-9 text-sm"
                    />
                    <FieldError message={errors.get("name")} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("customers.form.email")}
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); errors.clearField("email"); }}
                      placeholder={t("customers.form.emailPh")}
                      aria-invalid={!!errors.get("email")}
                      className="h-9 text-sm"
                    />
                    <FieldError message={errors.get("email")} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("customers.form.phone")}
                    </label>
                    <Input
                      value={phone}
                      onChange={e => { setPhone(e.target.value); errors.clearField("phone"); }}
                      placeholder={t("customers.form.phonePh")}
                      aria-invalid={!!errors.get("phone")}
                      className="h-9 text-sm"
                    />
                    <FieldError message={errors.get("phone")} />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("customers.form.ccEmails")}
                    </label>
                    <Input
                      value={ccEmails}
                      onChange={e => { setCcEmails(e.target.value); errors.clearField("ccEmails"); }}
                      placeholder={t("customers.form.ccEmailsPh")}
                      aria-invalid={!!errors.get("ccEmails")}
                      className="h-9 text-sm"
                    />
                    <FieldError message={errors.get("ccEmails")} />
                    <p className="text-[11px] text-muted-foreground">{t("customers.form.ccEmailsHint")}</p>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("customers.form.address")}
                    </label>
                    <textarea
                      value={address}
                      onChange={e => { setAddress(e.target.value); errors.clearField("address"); }}
                      placeholder={t("customers.form.addressPh")}
                      rows={3}
                      aria-invalid={!!errors.get("address")}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <FieldError message={errors.get("address")} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("customers.form.accounting")}
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("customers.form.account")}
                  </label>
                  {/* bg-card, not bg-transparent — a transparent select renders the OS-native
                      white popup in dark mode. */}
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{t("customers.form.accountNone")}</option>
                    {(accounts ?? []).map(a => (
                      <option key={a.id} value={a.id}>{a.accountNumber} — {a.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">{t("customers.form.accountHint")}</p>
                </div>

                <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{t("customers.form.active")}</span>
                </label>
                <p className="text-[11px] text-muted-foreground mt-1 ms-6">{t("customers.form.activeHint")}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                {t("customers.form.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending
                  ? <><Loader2 className="w-3.5 h-3.5 me-1 animate-spin" />{t("customers.form.saving")}</>
                  : isEdit ? t("customers.form.save") : t("customers.form.create")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
