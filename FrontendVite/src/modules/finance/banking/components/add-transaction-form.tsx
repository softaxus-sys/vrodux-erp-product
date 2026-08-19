import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBankAccounts, useCreateBankTransaction } from "@/hooks/finance/use-finance";
import { toast } from "sonner";

const CATEGORY_KEYS = [
  "revenue", "customerPayment", "vendorPayment", "salary", "rent", "utility",
  "tax", "loan", "interAccount", "bankCharges", "pettyCash", "other",
];

type TxType = "inflow" | "outflow" | "transfer";

interface AddTransactionFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransactionForm({ open, onClose }: AddTransactionFormProps) {
  const { t } = useTranslation("finance");
  const { data: bankAccounts = [] } = useBankAccounts();
  const createTransaction = useCreateBankTransaction();

  const [txType, setTxType]     = React.useState<TxType>("inflow");
  const [date, setDate]         = React.useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId]       = React.useState("");
  const [toAccountId, setToAccountId]   = React.useState("");
  const [amount, setAmount]     = React.useState("");
  const [category, setCategory] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [party, setParty]       = React.useState("");
  const [description, setDescription] = React.useState("");

  const isTransfer = txType === "transfer";
  const isValid = date && accountId && amount && parseFloat(amount) > 0 && category &&
    description.trim() && (!isTransfer || toAccountId);

  const reset = () => {
    setTxType("inflow");
    setDate(new Date().toISOString().split("T")[0]);
    setAccountId(""); setToAccountId(""); setAmount("");
    setCategory(""); setReference(""); setParty(""); setDescription("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = async () => {
    if (!isValid) return;

    const type: "credit" | "debit" = txType === "inflow" ? "credit" : "debit";
    const fullDescription = [description.trim(), party.trim()].filter(Boolean).join(" — ");

    try {
      await createTransaction.mutateAsync({
        accountId,
        date,
        description: fullDescription || category,
        type,
        category,
        amount:      parseFloat(amount),
        reference:   reference.trim() || undefined,
        toAccountId: isTransfer && toAccountId ? toAccountId : undefined,
      });
      toast.success(t("banking.txForm.recorded"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("banking.txForm.saveFailed"));
    }
  };

  const isPending = createTransaction.isPending;
  const selectedAccount = bankAccounts.find(a => a.id === accountId);

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
                <h2 className="text-base font-bold text-foreground">{t("banking.txForm.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("banking.txForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Transaction type */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("banking.txForm.transactionType")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "inflow",   label: t("banking.txForm.moneyIn"),  icon: ArrowDownLeft,  color: "text-success",     ring: "ring-success/40  bg-success/5" },
                    { value: "outflow",  label: t("banking.txForm.moneyOut"), icon: ArrowUpRight,   color: "text-destructive", ring: "ring-destructive/40 bg-destructive/5" },
                    { value: "transfer", label: t("banking.txForm.transfer"), icon: ArrowLeftRight, color: "text-primary",     ring: "ring-primary/40  bg-primary/5" },
                  ] as const).map(opt => {
                    const Icon = opt.icon;
                    const active = txType === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setTxType(opt.value)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium ${
                          active ? `border-current ring-2 ${opt.ring} ${opt.color}` : "border-border text-muted-foreground hover:border-primary/30"
                        }`}>
                        <Icon className={`w-5 h-5 ${active ? opt.color : ""}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.date")}</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.currency")}</label>
                  <Input
                    readOnly
                    value={selectedAccount?.currency ?? "—"}
                    className="h-9 text-sm bg-muted/30 cursor-default"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isTransfer ? t("banking.txForm.fromAccount") : t("banking.txForm.bankAccount")} {t("banking.txForm.required")}
                  </label>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">{t("banking.txForm.selectAccount")}</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} — {a.accountName} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {isTransfer && (
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.toAccount")}</label>
                    <select value={toAccountId} onChange={e => setToAccountId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("banking.txForm.selectAccount")}</option>
                      {bankAccounts.filter(a => a.id !== accountId).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} — {a.accountName} ({a.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.description")}</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={t("banking.txForm.descriptionPh")} className="h-9 text-sm" />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.amount")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                      {selectedAccount?.currency ?? "AED"}
                    </span>
                    <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm pl-12 text-right font-semibold" />
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.category")}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">{t("banking.txForm.selectCategory")}</option>
                    {CATEGORY_KEYS.map(key => {
                      const label = t(`banking.txForm.categories.${key}`);
                      return <option key={key} value={label}>{label}</option>;
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {txType === "inflow" ? t("banking.txForm.payer") : txType === "outflow" ? t("banking.txForm.payee") : t("banking.txForm.counterParty")}
                  </label>
                  <Input value={party} onChange={e => setParty(e.target.value)}
                    placeholder={txType === "inflow" ? t("banking.txForm.payerPh") : txType === "outflow" ? t("banking.txForm.payeePh") : t("banking.txForm.transferPartyPh")}
                    className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("banking.txForm.reference")}</label>
                  <Input value={reference} onChange={e => setReference(e.target.value)}
                    placeholder={t("banking.txForm.referencePh")} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || isPending}>
                {isPending ? t("common:action.saving") : t("banking.txForm.submit")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
