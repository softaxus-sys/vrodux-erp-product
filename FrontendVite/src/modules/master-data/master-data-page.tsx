/**
 * Master Data Management Page
 *
 * Unified catalog for every reference/configuration entity in the ERP.
 * Left panel  — category groups + master items with live counts.
 * Right panel — searchable data table + slide-over Add/Edit form.
 */

import * as React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Search, RefreshCw, ExternalLink,
  ChevronRight, Database, Loader2, AlertTriangle,
  X, Check, ChevronDown, ChevronUp, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { cn }     from "@/lib/utils";
import { toast }  from "sonner";
import {
  MASTER_REGISTRY, MASTER_CATEGORIES,
  getMasterById, getMastersByCategory,
  type MasterDef, type FormField,
} from "./registry";
import { useAuthStore } from "@/store/auth.store";
import type { ModuleKey } from "@/types";

// ─── Color palette (tailwind classes per color stem) ─────────────────────────

const COLOR: Record<string, {
  icon: string; iconBg: string; badge: string;
  ring: string; activeRow: string; header: string;
}> = {
  blue:    { icon: "text-blue-600",    iconBg: "bg-blue-50 dark:bg-blue-950/30",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",    ring: "ring-blue-500/40",    activeRow: "bg-blue-50/60 dark:bg-blue-950/20",    header: "from-blue-600 to-blue-700"    },
  emerald: { icon: "text-emerald-600", iconBg: "bg-emerald-50 dark:bg-emerald-950/30", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400", ring: "ring-emerald-500/40", activeRow: "bg-emerald-50/60 dark:bg-emerald-950/20", header: "from-emerald-600 to-emerald-700" },
  violet:  { icon: "text-violet-600",  iconBg: "bg-violet-50 dark:bg-violet-950/30",  badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",  ring: "ring-violet-500/40",  activeRow: "bg-violet-50/60 dark:bg-violet-950/20",  header: "from-violet-600 to-violet-700"  },
  rose:    { icon: "text-rose-600",    iconBg: "bg-rose-50 dark:bg-rose-950/30",    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",    ring: "ring-rose-500/40",    activeRow: "bg-rose-50/60 dark:bg-rose-950/20",    header: "from-rose-600 to-rose-700"    },
  orange:  { icon: "text-orange-600",  iconBg: "bg-orange-50 dark:bg-orange-950/30",  badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",  ring: "ring-orange-500/40",  activeRow: "bg-orange-50/60 dark:bg-orange-950/20",  header: "from-orange-600 to-orange-700"  },
  amber:   { icon: "text-amber-600",   iconBg: "bg-amber-50 dark:bg-amber-950/30",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",   ring: "ring-amber-500/40",   activeRow: "bg-amber-50/60 dark:bg-amber-950/20",   header: "from-amber-600 to-amber-700"   },
};

function palette(color: string) {
  return COLOR[color] ?? COLOR.blue;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  activeMasterId,
  counts,
  onSelect,
  visibleIds,
}: {
  activeMasterId: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  visibleIds: Set<string>;
}) {
  const navigate   = useNavigate();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  return (
    <aside className="w-72 shrink-0 flex flex-col h-full border-r border-border bg-card/50 overflow-y-auto">
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">Master Data</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reference tables</p>
          </div>
        </div>
      </div>

      {/* Category groups */}
      <nav className="flex-1 p-2 space-y-1">
        {MASTER_CATEGORIES.map(cat => {
          const masters  = getMastersByCategory(cat.id).filter(m => visibleIds.has(m.id));
          if (masters.length === 0) return null;
          const isOpen   = collapsed[cat.id] !== true;
          const pal      = palette(cat.color);

          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => setCollapsed(p => ({ ...p, [cat.id]: isOpen }))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <span className={cn(
                  "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
                  pal.iconBg, pal.icon,
                )}>
                  {cat.label[0]}
                </span>
                <span className="flex-1 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {cat.label}
                </span>
                {isOpen
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                }
              </button>

              {/* Master items */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden ml-1"
                  >
                    {masters.map(m => {
                      const isActive = m.id === activeMasterId;
                      const Icon     = m.icon;
                      const count    = counts[m.id];
                      const pal2     = palette(m.color);

                      return (
                        <button
                          key={m.id}
                          onClick={() => m.externalHref ? navigate(m.externalHref) : onSelect(m.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all my-0.5",
                            isActive
                              ? cn("text-foreground font-semibold shadow-sm ring-1", pal2.activeRow, pal2.ring)
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
                            isActive ? cn(pal2.iconBg, "opacity-100") : "bg-transparent",
                          )}>
                            <Icon className={cn("h-3.5 w-3.5", isActive ? pal2.icon : "text-current")} />
                          </div>
                          <span className="flex-1 text-sm">{m.label}</span>
                          {m.externalHref && (
                            <ExternalLink className="h-2.5 w-2.5 opacity-40 shrink-0" />
                          )}
                          {count !== undefined && !m.externalHref && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 min-w-[20px] text-center",
                              isActive ? pal2.badge : "bg-muted/60 text-muted-foreground",
                            )}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          {visibleIds.size} master tables · {Object.values(counts).reduce((s, v) => s + v, 0)} total records
        </p>
      </div>
    </aside>
  );
}

// ─── Form field renderer ──────────────────────────────────────────────────────

function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field:    FormField;
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const baseInput = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50";

  if (field.type === "toggle") {
    const checked = Boolean(value ?? field.defaultValue ?? false);
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-primary" : "bg-muted border border-border",
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )} />
      </button>
    );
  }

  if (field.type === "select") {
    const selected = (value as string) ?? (field.defaultValue as string) ?? "";
    return (
      <select
        value={selected}
        onChange={e => onChange(e.target.value)}
        className={cn(baseInput, "cursor-pointer")}
      >
        {!selected && <option value="" disabled>Select…</option>}
        {field.options?.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={cn(baseInput, "resize-none")}
      />
    );
  }

  if (field.type === "number" || field.type === "percent") {
    return (
      <div className="relative">
        <input
          type="number"
          value={(value as number) ?? (field.defaultValue as number) ?? ""}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={field.placeholder}
          min={0}
          step={field.type === "percent" ? "0.01" : "1"}
          className={cn(baseInput, field.type === "percent" ? "pr-8" : "")}
        />
        {field.type === "percent" && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        )}
      </div>
    );
  }

  return (
    <input
      type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
      value={(value as string) ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={baseInput}
    />
  );
}

// ─── Slide-over form panel ────────────────────────────────────────────────────

function FormPanel({
  master,
  editRecord,
  onClose,
  onSaved,
}: {
  master:      MasterDef;
  editRecord?: Record<string, unknown> | null;
  onClose:     () => void;
  onSaved:     () => void;
}) {
  const isEdit   = editRecord != null;
  const pal      = palette(master.color);
  const Icon     = master.icon;

  // Build initial form values
  const initial = React.useMemo(() => {
    const vals: Record<string, unknown> = {};
    master.formFields.forEach(f => {
      vals[f.key] = isEdit
        ? (editRecord?.[f.key] ?? f.defaultValue ?? "")
        : (f.defaultValue ?? "");
    });
    return vals;
  }, [master, editRecord, isEdit]);

  const [values,  setValues]  = React.useState<Record<string, unknown>>(initial);
  const [errors,  setErrors]  = React.useState<Record<string, string>>({});
  const [saving,  setSaving]  = React.useState(false);

  // Reset when master/record changes
  React.useEffect(() => {
    setValues(initial);
    setErrors({});
  }, [initial]);

  const set = (key: string, v: unknown) => {
    setValues(p => ({ ...p, [key]: v }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    master.formFields.forEach(f => {
      if (f.required) {
        const v = values[f.key];
        if (v == null || v === "" || (typeof v === "string" && !v.trim())) {
          errs[f.key] = `${f.label} is required`;
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      master.formFields.forEach(f => {
        const v = values[f.key];
        payload[f.key] = v === "" ? null : v;
      });

      if (isEdit && editRecord?.id) {
        await master.update?.(editRecord.id as string, payload);
        toast.success(`${master.label} updated`);
      } else {
        await master.create?.(payload);
        toast.success(`${master.label} added`);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="flex-1 bg-black/40 backdrop-blur-sm"
        />
        {/* Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full max-w-lg bg-background border-l border-border flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className={cn("bg-gradient-to-br p-5 text-white shrink-0", pal.header)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-base leading-none">
                    {isEdit ? `Edit ${master.label}` : `Add ${master.label}`}
                  </p>
                  <p className="text-white/70 text-xs mt-1">{master.description}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-4">
              {master.formFields.map(field => (
                <div
                  key={field.key}
                  className={field.span === "full" ? "col-span-2" : "col-span-1"}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-foreground">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    {field.type === "toggle" && (
                      <FormFieldInput field={field} value={values[field.key]} onChange={v => set(field.key, v)} />
                    )}
                  </div>
                  {field.type !== "toggle" && (
                    <FormFieldInput field={field} value={values[field.key]} onChange={v => set(field.key, v)} />
                  )}
                  {errors[field.key] && (
                    <p className="text-destructive text-[11px] mt-1">{errors[field.key]}</p>
                  )}
                  {field.helpText && !errors[field.key] && (
                    <p className="text-muted-foreground text-[11px] mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-5 py-4 flex items-center justify-between shrink-0 bg-muted/20">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2 min-w-[110px]">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                : <><Check className="h-4 w-4" />{isEdit ? "Update" : "Add"}</>
              }
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Delete confirm popover ───────────────────────────────────────────────────

function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
}: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute right-0 top-8 z-20 w-64 bg-popover border border-border rounded-xl shadow-lg p-3">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Delete <span className="font-semibold">"{label}"</span>? This cannot be undone.
        </p>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────

function DataTable({
  master,
  data,
  search,
  onEdit,
  onDelete,
}: {
  master:   MasterDef;
  data:     Record<string, unknown>[];
  search:   string;
  onEdit:   (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}) {
  const pal = palette(master.color);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      master.searchKeys.some(k => {
        const v = row[k];
        return typeof v === "string" && v.toLowerCase().includes(q);
      })
    );
  }, [data, search, master.searchKeys]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", pal.iconBg)}>
          <master.icon className={cn("h-8 w-8", pal.icon)} />
        </div>
        <p className="text-base font-semibold text-foreground">
          {search ? "No results found" : `No ${master.pluralLabel ?? master.label} yet`}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {search
            ? `Try adjusting your search for "${search}"`
            : master.description}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {master.columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                  col.align === "center" && "text-center",
                  col.align === "right"  && "text-right",
                  col.width && `w-[${col.width}]`,
                )}
              >
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {filtered.map((row, idx) => {
              const rowId = (row.id as string) ?? String(idx);
              return (
                <motion.tr
                  key={rowId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                >
                  {master.columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-foreground",
                        col.align === "center" && "text-center",
                        col.align === "right"  && "text-right",
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : <span className="text-sm">{row[col.key] as string ?? "—"}</span>
                      }
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 relative">
                      {/* Edit */}
                      {master.update && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Delete */}
                      {master.remove && (
                        <div className="relative">
                          <button
                            onClick={() => setConfirmId(rowId === confirmId ? null : rowId)}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {confirmId === rowId && (
                            <DeleteConfirm
                              label={(row[(master.nameKey ?? "name")] as string) ?? "this record"}
                              onConfirm={() => { setConfirmId(null); onDelete(row); }}
                              onCancel={() => setConfirmId(null)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail panel (right side content) ───────────────────────────────────────

function DetailPanel({ master }: { master: MasterDef }) {
  const navigate      = useNavigate();   // used by externalHref card
  const queryClient   = useQueryClient();
  const pal           = palette(master.color);
  const Icon          = master.icon;

  const [search,      setSearch]      = React.useState("");
  const [formOpen,    setFormOpen]    = React.useState(false);
  const [editRecord,  setEditRecord]  = React.useState<Record<string, unknown> | null>(null);

  // ── Data query ────────────────────────────────────────────────────────────
  const qKey = ["master-data", master.id];
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: qKey,
    queryFn:  () => master.fetchAll(),
    staleTime: 60 * 1000,
    enabled:  !master.externalHref,
  });

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (row: Record<string, unknown>) => master.remove!(row.id as string),
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: qKey });
      toast.success(`${master.label} deleted`);
      void row;
    },
    onError: () => toast.error("Delete failed"),
  });

  const openAdd  = () => { setEditRecord(null); setFormOpen(true); };
  const openEdit = (row: Record<string, unknown>) => { setEditRecord(row); setFormOpen(true); };
  const onSaved  = () => queryClient.invalidateQueries({ queryKey: qKey });

  if (master.externalHref) {
    const pal  = palette(master.color);
    const Icon = master.icon;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-inner", pal.iconBg)}>
          <Icon className={cn("h-10 w-10", pal.icon)} />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{master.label}</h2>
        <p className="text-muted-foreground max-w-sm mb-6">{master.description}</p>
        <Button onClick={() => navigate(master.externalHref!)} className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Open {master.label} Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Content header ── */}
      <div className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", pal.iconBg)}>
              <Icon className={cn("h-5 w-5", pal.icon)} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{master.label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{master.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
            {master.create && (
              <Button onClick={openAdd} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add {master.label}
              </Button>
            )}
          </div>
        </div>

        {/* Search + stats */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${master.label.toLowerCase()}…`}
              className="pl-8 h-8 text-sm bg-muted/40"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs font-semibold px-2 py-1 rounded-lg", pal.badge)}>
              {isLoading ? "…" : data.length} records
            </span>
          </div>
        </div>
      </div>

      {/* ── Table area ── */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex flex-col gap-3 p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Failed to load data</p>
              <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && (
          <DataTable
            master={master}
            data={data}
            search={search}
            onEdit={openEdit}
            onDelete={row => deleteMut.mutate(row)}
          />
        )}
      </div>

      {/* ── Form slide-over ── */}
      {formOpen && (
        <FormPanel
          master={master}
          editRecord={editRecord}
          onClose={() => setFormOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ─── Welcome screen (no master selected) ─────────────────────────────────────

function WelcomeScreen({ onSelect, masters }: { onSelect: (id: string) => void; masters: MasterDef[] }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5 shadow-inner">
        <Database className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Master Data Registry</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        All reference data in one place. Select a master table from the sidebar
        to view, add, update, or delete records.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-3xl">
        {masters.filter(m => !m.externalHref).slice(0, 12).map(m => {
          const pal  = palette(m.color);
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/20 transition-all text-left group shadow-sm"
            >
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", pal.iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", pal.icon)} />
              </div>
              <span className="text-xs font-semibold text-foreground leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

export function MasterDataPage() {
  const [params, setParams]  = useSearchParams();
  const queryClient           = useQueryClient();
  const hasModuleAccess       = useAuthStore(s => s.hasModuleAccess);

  // Only show master tables whose module the tenant can access.
  const visibleMasters = React.useMemo(
    () => MASTER_REGISTRY.filter(m => hasModuleAccess(m.module as ModuleKey)),
    [hasModuleAccess],
  );
  const visibleIds = React.useMemo(() => new Set(visibleMasters.map(m => m.id)), [visibleMasters]);

  const activeMasterId        = params.get("type") ?? "";
  const activeMasterRaw       = getMasterById(activeMasterId);
  // Block deep-links to masters the tenant isn't entitled to.
  const activeMaster          = activeMasterRaw && visibleIds.has(activeMasterRaw.id) ? activeMasterRaw : undefined;

  // Pre-fetch counts for all API-backed masters (best-effort)
  const { data: allCounts = {} } = useQuery({
    queryKey: ["master-data-counts", [...visibleIds].sort().join(",")],
    queryFn: async () => {
      const results: Record<string, number> = {};
      await Promise.allSettled(
        visibleMasters.filter(m => !m.externalHref).map(async m => {
          try {
            const items = await m.fetchAll();
            results[m.id] = items.length;
          } catch { results[m.id] = 0; }
        })
      );
      return results;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const selectMaster = (id: string) => {
    setParams({ type: id });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Left sidebar */}
      <Sidebar
        activeMasterId={activeMaster ? activeMasterId : ""}
        counts={allCounts}
        onSelect={selectMaster}
        visibleIds={visibleIds}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeMaster ? (
          <DetailPanel key={activeMaster.id} master={activeMaster} />
        ) : (
          <WelcomeScreen onSelect={selectMaster} masters={visibleMasters} />
        )}
      </main>
    </div>
  );
}
