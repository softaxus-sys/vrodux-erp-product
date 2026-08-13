import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, RotateCcw, X, Loader2, AlertTriangle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { tenantsAdminApi, planLimits, type TenantDto } from "@/lib/admin/tenants.api";

/**
 * Recycle bin for soft-deleted tenants.
 *
 * Deleting a tenant only sets IsDeleted (BaseDbContext turns Remove into a soft delete) and the
 * global query filter then hides it — so without this panel a deleted tenant was invisible and
 * unrecoverable while all of its data sat in the database.
 *
 * Permanent deletion requires typing the tenant's name. That friction is deliberate: a purge is
 * irreversible and there is no backup-free way to undo it.
 */
export function DeletedTenantsPanel({
  open, onClose, onRestored,
}: {
  open: boolean;
  onClose: () => void;
  /** Lets the parent refresh its live tenant list after a restore. */
  onRestored: () => void;
}) {
  const [tenants, setTenants]   = React.useState<TenantDto[]>([]);
  const [loading, setLoading]   = React.useState(false);
  const [busyId, setBusyId]     = React.useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = React.useState<TenantDto | null>(null);
  const [confirmName, setConfirmName] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setTenants(await tenantsAdminApi.getDeleted());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load deleted tenants.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    load();
    setPurgeTarget(null);
    setConfirmName("");
  }, [open, load]);

  const handleRestore = async (t: TenantDto) => {
    try {
      setBusyId(t.id);
      await tenantsAdminApi.restore(t.id);
      toast.success(`${t.name} restored.`);
      setTenants(prev => prev.filter(x => x.id !== t.id));
      onRestored();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore tenant.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    try {
      setBusyId(purgeTarget.id);
      await tenantsAdminApi.purge(purgeTarget.id);
      toast.success(`${purgeTarget.name} permanently deleted.`);
      setTenants(prev => prev.filter(x => x.id !== purgeTarget.id));
      setPurgeTarget(null);
      setConfirmName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete tenant.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-card border-l border-border shadow-xl flex flex-col">

            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                  Deleted tenants
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deleted tenants keep all their data and cannot log in. Restore, or delete permanently.
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-6 space-y-3">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">Recycle bin is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">No deleted tenants.</p>
                </div>
              ) : (
                tenants.map(t => (
                  <div key={t.id}
                    className="border border-border rounded-lg p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.slug} · {planLimits(t.plan).label}
                        {t.contactEmail ? ` · ${t.contactEmail}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deleted {t.deletedAt ? formatDate(t.deletedAt) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" disabled={busyId === t.id}
                        onClick={() => handleRestore(t)}>
                        {busyId === t.id && !purgeTarget
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Restore</>}
                      </Button>
                      <Button variant="ghost" size="sm"
                        className="text-destructive hover:bg-destructive/5"
                        onClick={() => { setPurgeTarget(t); setConfirmName(""); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Permanent delete — name confirmation, because this cannot be undone */}
          <AnimatePresence>
            {purgeTarget && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
                onClick={() => setPurgeTarget(null)}>
                <motion.div
                  initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .95, opacity: 0 }}
                  className="bg-card border border-border rounded-xl max-w-md w-full p-6"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">Permanently delete {purgeTarget.name}?</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        This cannot be undone. The tenant, its users, roles and billing history are
                        removed for good — only a database backup could bring them back.
                      </p>
                    </div>
                  </div>

                  <label className="text-xs font-medium text-muted-foreground">
                    Type <span className="font-mono text-foreground">{purgeTarget.name}</span> to confirm
                  </label>
                  <Input value={confirmName} onChange={e => setConfirmName(e.target.value)}
                    className="mt-1.5" placeholder={purgeTarget.name} autoFocus />

                  <div className="flex justify-end gap-2 mt-5">
                    <Button variant="outline" size="sm" onClick={() => setPurgeTarget(null)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm"
                      disabled={confirmName.trim() !== purgeTarget.name || busyId === purgeTarget.id}
                      onClick={handlePurge}>
                      {busyId === purgeTarget.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : "Delete permanently"}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

/** Small helper so the parent can badge the button with a count without duplicating the fetch. */
export function useDeletedTenantCount(refreshKey: unknown): number {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    tenantsAdminApi.getDeleted()
      .then(list => { if (!cancelled) setCount(list.length); })
      .catch(() => { /* non-critical badge */ });
    return () => { cancelled = true; };
  }, [refreshKey]);
  return count;
}
