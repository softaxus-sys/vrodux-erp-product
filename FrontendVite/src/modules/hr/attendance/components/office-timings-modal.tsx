import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkSchedule, useUpdateWorkSchedule } from "@/hooks/hr/use-hr";

/** Sunday-first, matching JavaScript getDay() and the day numbers the API stores. */
const DAYS = [
  { value: 0, key: "sun" }, { value: 1, key: "mon" }, { value: 2, key: "tue" },
  { value: 3, key: "wed" }, { value: 4, key: "thu" }, { value: 5, key: "fri" },
  { value: 6, key: "sat" },
];

/**
 * A short list rather than the full IANA database: a picker with 400 entries is worse than a few
 * relevant ones, and a zone already in use that isn't listed is added rather than dropped.
 */
const ZONES = [
  "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata",
  "Europe/London", "America/New_York", "UTC",
];

/**
 * Office hours for the whole tenant — the definition of "on time".
 *
 * Editing them changes only future judgements: each attendance row keeps the verdict recorded on
 * the day, so correcting the schedule never rewrites who was late last month.
 */
export function OfficeTimingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const { data: schedule, isLoading } = useWorkSchedule();
  const update = useUpdateWorkSchedule();

  const [start, setStart] = React.useState("09:00");
  const [end, setEnd]     = React.useState("18:00");
  const [grace, setGrace] = React.useState(15);
  const [days, setDays]   = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [zone, setZone]   = React.useState("Asia/Dubai");

  React.useEffect(() => {
    if (!open || !schedule) return;
    setStart(schedule.startTime);
    setEnd(schedule.endTime);
    setGrace(schedule.graceMinutes);
    setDays(schedule.workingDays);
    setZone(schedule.timeZoneId);
  }, [open, schedule]);

  const toggleDay = (d: number) =>
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()));

  const save = async () => {
    try {
      await update.mutateAsync({
        name: schedule?.name ?? "Standard office hours",
        startTime: start, endTime: end, graceMinutes: grace,
        workingDays: days, timeZoneId: zone,
      });
      onClose();
    } catch {
      // The hook surfaces the error; the dialog stays open so it can be corrected.
    }
  };

  const canSave = days.length > 0 && start !== end && !update.isPending;
  const zoneOptions = ZONES.includes(zone) ? ZONES : [zone, ...ZONES];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={onClose} />
          {/* Flex-centred: Framer owns `transform` for the scale animation and would overwrite
              Tailwind's translate-based centring. */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto w-[min(32rem,92vw)] bg-card border border-border rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-bold">{t("attendance.timings.title")}</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("attendance.timings.start")}
                      </label>
                      <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("attendance.timings.end")}
                      </label>
                      <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("attendance.timings.grace")}
                    </label>
                    <Input type="number" min={0} max={240} value={grace}
                      onChange={e => setGrace(Math.max(0, Number(e.target.value) || 0))}
                      className="h-9 text-sm w-28" />
                    <p className="text-[11px] text-muted-foreground">{t("attendance.timings.graceHint")}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("attendance.timings.workingDays")}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map(d => (
                        <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                          className={days.includes(d.value)
                            ? "h-8 px-3 rounded-lg border text-xs font-medium transition-colors bg-primary border-primary text-white"
                            : "h-8 px-3 rounded-lg border text-xs font-medium transition-colors bg-muted/20 border-border text-muted-foreground hover:border-primary/50"}>
                          {t("attendance.timings.day." + d.key)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("attendance.timings.timezone")}
                    </label>
                    <select value={zone} onChange={e => setZone(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">{t("attendance.timings.timezoneHint")}</p>
                  </div>

                  <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
                    {t("attendance.timings.historyNote")}
                  </p>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={update.isPending}>
                      {t("attendance.timings.cancel")}
                    </Button>
                    <Button onClick={save} disabled={!canSave}>
                      {update.isPending ? t("attendance.timings.saving") : t("attendance.timings.save")}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
