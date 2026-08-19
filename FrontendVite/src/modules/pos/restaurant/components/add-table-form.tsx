import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTable } from "@/hooks/restaurant/use-restaurant";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";

/** `value` is the stored/API value; the emoji is data, labels come from i18n (tableForm.sections.*). */
const SECTIONS = [
  { value: "indoor",  icon: "🏠" },
  { value: "outdoor", icon: "☀️" },
  { value: "terrace", icon: "🌅" },
  { value: "private", icon: "🍽️" },
];

const TABLE_SHAPES = ["Round", "Square", "Rectangle", "Booth"];

interface AddTableFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddTableForm({ open, onClose }: AddTableFormProps) {
  const { t } = useTranslation("restaurant");
  const [section, setSection]         = React.useState("indoor");
  const [shape, setShape]             = React.useState("Square");
  const [tableNumber, setTableNumber] = React.useState("");
  const [capacity, setCapacity]       = React.useState("4");
  const [minCapacity, setMinCapacity] = React.useState("1");
  const [location, setLocation]       = React.useState("");
  const [isJoinable, setIsJoinable]   = React.useState(false);
  const [isPremium, setIsPremium]     = React.useState(false);
  const [notes, setNotes]             = React.useState("");

  const createTable = useCreateTable();
  const { branchId } = useCurrentBranch();
  const isValid = tableNumber.trim() && parseInt(capacity) > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await createTable.mutateAsync({
        tableNumber: tableNumber.trim(),
        section,
        capacity: parseInt(capacity, 10) || 1,
        branchId,
      });
      onClose();
    } catch { /* toast in hook */ }
  };

  const reset = () => {
    setSection("indoor"); setShape("Square"); setTableNumber(""); setCapacity("4");
    setMinCapacity("1"); setLocation(""); setIsJoinable(false); setIsPremium(false); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">{t("tableForm.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("tableForm.description")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.section")}</label>
                <div className="space-y-1.5">
                  {SECTIONS.map(s => (
                    <button key={s.value} onClick={() => setSection(s.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                        section === s.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                      <span className="text-base">{s.icon}</span>
                      <div>
                        <p className={`text-xs font-semibold ${section === s.value ? "text-primary" : "text-foreground"}`}>
                          {t(`tableForm.sections.${s.value}`)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{t(`tableForm.sections.${s.value}Desc`)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Details */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("tableForm.details")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.tableNumber")}</label>
                    <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder={t("tableForm.tableNumberPlaceholder")} className="h-9 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.maxCapacity")}</label>
                    <Input type="number" min={1} max={30} value={capacity} onChange={e => setCapacity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.minGuests")}</label>
                    <Input type="number" min={1} value={minCapacity} onChange={e => setMinCapacity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.shape")}</label>
                    <div className="grid grid-cols-4 gap-2">
                      {TABLE_SHAPES.map(sh => (
                        <button key={sh} onClick={() => setShape(sh)}
                          className={`py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                            shape === sh ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                          }`}>{t(`tableForm.shapes.${sh}`)}</button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.location")}</label>
                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={t("tableForm.locationPlaceholder")} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.options")}</p>
                <div className="flex items-center justify-between px-3 py-3 bg-muted/30 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold">{t("tableForm.joinable")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("tableForm.joinableHint")}</p>
                  </div>
                  <button onClick={() => setIsJoinable(p => !p)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${isJoinable ? "bg-primary" : "bg-muted"}`}>
                    <motion.span animate={{ x: isJoinable ? 16 : 2 }}
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <div className="flex items-center justify-between px-3 py-3 bg-muted/30 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold">{t("tableForm.premium")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("tableForm.premiumHint")}</p>
                  </div>
                  <button onClick={() => setIsPremium(p => !p)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${isPremium ? "bg-warning" : "bg-muted"}`}>
                    <motion.span animate={{ x: isPremium ? 16 : 2 }}
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tableForm.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("tableForm.notesPlaceholder")} rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createTable.isPending}>{t("tableForm.button.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || createTable.isPending}>
                {createTable.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t("tableForm.button.adding")}</> : t("tableForm.button.submit")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

