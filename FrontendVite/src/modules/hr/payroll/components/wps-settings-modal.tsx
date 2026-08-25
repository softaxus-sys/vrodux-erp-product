import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { X, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWpsConfig, useUpdateWpsConfig } from "@/hooks/hr/use-hr";

/**
 * The two employer identifiers every UAE salary file carries.
 *
 * <p>Neither can be derived or defaulted: MOHRE matches the establishment number against the
 * company's own record, and the routing code is issued by whichever bank or exchange house acts
 * as the WPS agent. They are asked for once and stored, rather than guessed at export time.</p>
 */
export function WpsSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const { data: config } = useWpsConfig();
  const update = useUpdateWpsConfig();

  const [establishment, setEstablishment] = React.useState("");
  const [routing, setRouting] = React.useState("");

  React.useEffect(() => {
    if (!open || !config) return;
    setEstablishment(config.employerUniqueId);
    setRouting(config.employerBankRoutingCode);
  }, [open, config]);

  const save = async () => {
    try {
      await update.mutateAsync({
        employerUniqueId: establishment.trim(),
        employerBankRoutingCode: routing.trim(),
      });
      onClose();
    } catch {
      // The hook reports the error; the dialog stays open so it can be corrected.
    }
  };

  const canSave = establishment.trim().length > 0 && routing.trim().length > 0 && !update.isPending;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]" onClick={onClose} />
          {/* Flex-centred: Framer owns `transform`, which would overwrite Tailwind's translate. */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto w-[min(30rem,92vw)] bg-card border border-border rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-bold">{t("payroll.wps.settingsTitle")}</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("payroll.wps.establishmentId")}
                  </label>
                  <Input value={establishment} onChange={e => setEstablishment(e.target.value)}
                    className="h-9 text-sm font-mono" placeholder="1234567890123" />
                  <p className="text-[11px] text-muted-foreground">{t("payroll.wps.establishmentHint")}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("payroll.wps.routingCode")}
                  </label>
                  <Input value={routing} onChange={e => setRouting(e.target.value)}
                    className="h-9 text-sm font-mono" placeholder="123456789" />
                  <p className="text-[11px] text-muted-foreground">{t("payroll.wps.routingHint")}</p>
                </div>

                {config && config.fileSequence > 0 && (
                  <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
                    {t("payroll.wps.sequenceNote", { n: config.fileSequence })}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose} disabled={update.isPending}>
                    {t("payroll.wps.cancel")}
                  </Button>
                  <Button onClick={save} disabled={!canSave}>
                    {update.isPending ? t("payroll.wps.saving") : t("payroll.wps.save")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
