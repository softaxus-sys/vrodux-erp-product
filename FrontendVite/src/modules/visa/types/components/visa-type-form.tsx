import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import { useCreateVisaType, useUpdateVisaType } from "@/hooks/visa/use-visa";
import { VISA_CATEGORIES, VISA_CHANNELS, type VisaTypeDto } from "@/lib/visa/visa.api";

interface Props { open: boolean; onClose: () => void; editing?: VisaTypeDto | null; }

export function VisaTypeForm({ open, onClose, editing }: Props) {
  const { t } = useTranslation("visa");
  const currency = useCurrency();
  const isEdit = !!editing;
  const create = useCreateVisaType();
  const update = useUpdateVisaType();
  const saving = create.isPending || update.isPending;

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("employment");
  const [channel, setChannel] = React.useState("manual");
  const [govtFee, setGovtFee] = React.useState("");
  const [serviceFee, setServiceFee] = React.useState("");
  const [days, setDays] = React.useState("14");
  const [docs, setDocs] = React.useState<string[]>([]);
  const [newDoc, setNewDoc] = React.useState("");

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name); setCategory(editing.category); setChannel(editing.channel);
      setGovtFee(String(editing.defaultGovtFee)); setServiceFee(String(editing.defaultServiceFee));
      setDays(String(editing.processingDays)); setDocs([...editing.requiredDocuments]);
    } else if (open) {
      setName(""); setCategory("employment"); setChannel("manual");
      setGovtFee(""); setServiceFee(""); setDays("14"); setDocs([]); setNewDoc("");
    }
  }, [open, editing]);

  const addDoc = () => { const d = newDoc.trim(); if (d) { setDocs(p => [...p, d]); setNewDoc(""); } };
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const body = {
      name: name.trim(), category, channel,
      defaultGovtFee: parseFloat(govtFee) || 0,
      defaultServiceFee: parseFloat(serviceFee) || 0,
      processingDays: parseInt(days, 10) || 0,
      requiredDocuments: docs,
    };
    if (isEdit && editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">{isEdit ? t("types.form.titleEdit") : t("types.form.titleNew")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("types.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.name")}</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("types.form.namePlaceholder")} className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.category")}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {VISA_CATEGORIES.map(c => <option key={c} value={c}>{t(`types.category.${c}`, { defaultValue: c })}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.channel")}</label>
                  <select value={channel} onChange={e => setChannel(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {VISA_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.govtFee", { currency })}</label>
                  <Input type="number" min={0} value={govtFee} onChange={e => setGovtFee(e.target.value)} className="h-9 text-sm text-right" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.serviceFee", { currency })}</label>
                  <Input type="number" min={0} value={serviceFee} onChange={e => setServiceFee(e.target.value)} className="h-9 text-sm text-right" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.processingDays")}</label>
                  <Input type="number" min={0} value={days} onChange={e => setDays(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("types.form.requiredDocs")}</label>
                <div className="flex gap-2">
                  <Input value={newDoc} onChange={e => setNewDoc(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addDoc())}
                    placeholder={t("types.form.addDocPlaceholder")} className="h-9 text-sm flex-1" />
                  <Button size="sm" className="h-9 gap-1" onClick={addDoc} disabled={!newDoc.trim()}><Plus className="h-3.5 w-3.5" />{t("types.form.button.add")}</Button>
                </div>
                <div className="space-y-1.5">
                  {docs.map((d, i) => (
                    <div key={`${d}-${i}`} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-sm flex-1 truncate">{d}</span>
                      <button onClick={() => setDocs(p => p.filter((_, idx) => idx !== i))}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={t("types.form.button.remove")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {docs.length === 0 && <p className="text-xs text-muted-foreground">{t("types.form.noDocs")}</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("types.form.button.cancel")}</Button>
              <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? t("types.form.button.save") : t("types.form.button.create")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
