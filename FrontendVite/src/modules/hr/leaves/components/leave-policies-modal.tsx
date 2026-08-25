import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useLeavePolicies, useCreateLeavePolicy, useUpdateLeavePolicy, useDeleteLeavePolicy,
} from "@/hooks/hr/use-hr";

interface Props { open: boolean; onClose: () => void; }

/**
 * Tenant leave entitlements. These drive every balance in HR, so editing one here
 * changes what employees have left — balances are derived, never stored.
 */
export function LeavePoliciesModal({ open, onClose }: Props) {
  const { t } = useTranslation("hr");
  const { data: policies = [], isLoading } = useLeavePolicies();
  const createPolicy = useCreateLeavePolicy();
  const updatePolicy = useUpdateLeavePolicy();
  const deletePolicy = useDeleteLeavePolicy();

  const [newType, setNewType] = React.useState("");
  const [newDays, setNewDays] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) { setNewType(""); setNewDays(""); setPendingDelete(null); }
  }, [open]);

  const addPolicy = () => {
    if (!newType.trim()) return;
    createPolicy.mutate(
      { leaveType: newType.trim(), annualEntitlementDays: Number(newDays) || 0, isPaid: true },
      { onSuccess: () => { setNewType(""); setNewDays(""); } }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto w-[min(38rem,92vw)] max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
            >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">{t("leaves.policies.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("leaves.policies.subtitle")}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {isLoading ? (
                <p className="text-xs text-muted-foreground">{t("leaves.policies.loading")}</p>
              ) : policies.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t(`leaveType.${p.leaveType}`, { defaultValue: p.leaveType })}</p>
                    {p.description && <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number" min={0} max={365} step={0.5}
                      defaultValue={p.annualEntitlementDays}
                      onBlur={e => {
                        const days = Number(e.target.value);
                        if (days === p.annualEntitlementDays || Number.isNaN(days)) return;
                        updatePolicy.mutate({
                          id: p.id, annualEntitlementDays: days, isPaid: p.isPaid,
                          description: p.description ?? undefined, isActive: p.isActive,
                        });
                      }}
                      className="h-8 w-20 text-sm text-right"
                    />
                    <span className="text-xs text-muted-foreground w-10">{t("leaves.policies.days")}</span>
                    <button
                      type="button"
                      onClick={() => updatePolicy.mutate({
                        id: p.id, annualEntitlementDays: p.annualEntitlementDays, isPaid: !p.isPaid,
                        description: p.description ?? undefined, isActive: p.isActive,
                      })}
                      title={t("leaves.policies.togglePaid")}
                      className={cn(
                        "h-8 px-2 rounded-lg border text-[11px] font-semibold transition-colors shrink-0",
                        p.isPaid
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground"
                      )}>
                      {p.isPaid ? t("leaves.policies.paid") : t("leaves.policies.unpaid")}
                    </button>
                    {pendingDelete === p.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-8 text-xs"
                          onClick={() => { deletePolicy.mutate(p.id); setPendingDelete(null); }}>
                          {t("leaves.policies.confirmRemove")}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPendingDelete(null)}>
                          {t("leaves.policies.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("leaves.policies.addTitle")}</p>
              <div className="flex items-center gap-2">
                <Input value={newType} onChange={e => setNewType(e.target.value)}
                  placeholder={t("leaves.policies.typePlaceholder")} className="h-9 text-sm flex-1" />
                <Input type="number" min={0} max={365} step={0.5} value={newDays} onChange={e => setNewDays(e.target.value)}
                  placeholder={t("leaves.policies.days")} className="h-9 w-24 text-sm text-right" />
                <Button size="sm" className="h-9 gap-1.5" onClick={addPolicy}
                  disabled={!newType.trim() || createPolicy.isPending}>
                  <Plus className="h-4 w-4" />{t("leaves.policies.add")}
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
