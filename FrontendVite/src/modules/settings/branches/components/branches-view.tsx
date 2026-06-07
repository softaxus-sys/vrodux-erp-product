import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Users, Phone, Mail, Globe, Building2,
  X, Plus, Pencil, Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch,
} from "@/hooks/identity/use-branches";
import type { BranchDto, UpsertBranchRequest } from "@/lib/identity/branches.api";

// ── Local view type (maps from BranchDto, null-safe for form fields) ─────────

type BranchType   = "main" | "regional" | "international";
type BranchStatus = "active" | "inactive";

interface Branch {
  id: string;
  code: string;
  name: string;
  type: BranchType;
  city: string;
  country: string;
  flag: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  staff: number;
  status: BranchStatus;
  currency: string;
  timezone: string;
  openedDate: string;
}

function toLocalBranch(dto: BranchDto): Branch {
  return {
    id:         dto.id,
    code:       dto.code,
    name:       dto.name,
    type:       (dto.type as BranchType) ?? "regional",
    city:       dto.city,
    country:    dto.country,
    flag:       dto.flag,
    address:    dto.address  ?? "",
    phone:      dto.phone    ?? "",
    email:      dto.email    ?? "",
    manager:    dto.manager  ?? "",
    staff:      dto.staff,
    status:     (dto.status as BranchStatus) ?? "active",
    currency:   dto.currency,
    timezone:   dto.timezone,
    openedDate: dto.openedDate ?? "",
  };
}

// ── Configs ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<BranchType, { label: string; color: string; bg: string }> = {
  main:          { label: "Main",          color: "text-primary",           bg: "bg-primary/10" },
  regional:      { label: "Regional",      color: "text-amber-600",         bg: "bg-amber-50 dark:bg-amber-950/30" },
  international: { label: "International", color: "text-muted-foreground",  bg: "bg-muted" },
};

const CURRENCY_OPTIONS = ["PKR","AED","USD","EUR","GBP","SAR"];
const TIMEZONE_OPTIONS = [
  "Asia/Karachi (UTC+5)", "Asia/Dubai (UTC+4)", "Asia/Riyadh (UTC+3)",
  "Europe/London (UTC+1)", "America/New_York (UTC-5)", "Asia/Kolkata (UTC+5:30)",
];

// ── Branch Form ───────────────────────────────────────────────────────────────

const EMPTY_BRANCH: Omit<Branch, "id"> = {
  code: "", name: "", type: "regional", city: "", country: "Pakistan", flag: "🇵🇰",
  address: "", phone: "", email: "", manager: "", staff: 0,
  status: "active", currency: "PKR", timezone: "Asia/Karachi (UTC+5)", openedDate: "",
};

function BranchFormModal({
  initial, title, onSave, onClose,
}: {
  initial?: Branch;
  title: string;
  onSave: (data: Omit<Branch, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = React.useState<Omit<Branch, "id">>(
    initial ? { ...initial } : { ...EMPTY_BRANCH }
  );

  const set = (key: keyof Omit<Branch, "id">, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isValid = form.name.trim() && form.code.trim() && form.city.trim();

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="font-bold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branch Name *</label>
                <Input value={form.name} onChange={e => set("name", e.target.value)}
                  placeholder="e.g. Karachi HQ" className="h-9" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branch Code *</label>
                <Input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())}
                  placeholder="e.g. KHI-HQ" className="h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                <select value={form.type} onChange={e => set("type", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="main">Main</option>
                  <option value="regional">Regional</option>
                  <option value="international">International</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City *</label>
                <Input value={form.city} onChange={e => set("city", e.target.value)}
                  placeholder="e.g. Karachi" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</label>
                <Input value={form.country} onChange={e => set("country", e.target.value)}
                  placeholder="e.g. Pakistan" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flag emoji</label>
                <Input value={form.flag} onChange={e => set("flag", e.target.value)}
                  placeholder="🇵🇰" className="h-9 text-lg" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
                <select value={form.currency} onChange={e => set("currency", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timezone</label>
                <select value={form.timezone} onChange={e => set("timezone", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {TIMEZONE_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Address</label>
                <Input value={form.address} onChange={e => set("address", e.target.value)}
                  placeholder="Street address" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)}
                  placeholder="+92 21 xxx xxxx" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                <Input value={form.email} onChange={e => set("email", e.target.value)}
                  placeholder="branch@company.io" className="h-9" type="email" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manager</label>
                <Input value={form.manager} onChange={e => set("manager", e.target.value)}
                  placeholder="Manager name" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff Count</label>
                <Input value={form.staff} onChange={e => set("staff", Number(e.target.value))}
                  type="number" min="0" className="h-9" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opening Date</label>
                <Input value={form.openedDate} onChange={e => set("openedDate", e.target.value)}
                  type="date" className="h-9" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex gap-2 shrink-0">
            <Button className="flex-1" onClick={() => isValid && onSave(form)} disabled={!isValid}>
              Save Branch
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Confirm Delete Modal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({
  branchName, onConfirm, onCancel,
}: { branchName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <motion.div className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
      <motion.div className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold">Delete branch?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-semibold text-foreground">"{branchName}"</span> will be permanently removed.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={onConfirm}>
              <Trash2 className="h-4 w-4 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Branch Detail Drawer ──────────────────────────────────────────────────────

function BranchDetailDrawer({
  branch, onClose, onEdit, onDelete,
}: { branch: Branch; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const typeCfg = TYPE_CONFIG[branch.type];
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Branch Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-4xl shrink-0">
              {branch.flag}
            </div>
            <div>
              <h3 className="text-xl font-bold">{branch.name}</h3>
              <p className="text-sm text-muted-foreground">{branch.city}, {branch.country}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", typeCfg.color, typeCfg.bg)}>
                  {typeCfg.label}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                  branch.status === "active" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-muted-foreground bg-muted")}>
                  {branch.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
            {[
              { label: "Branch Code", value: branch.code },
              { label: "Manager",     value: branch.manager || "—" },
              { label: "Staff Count", value: `${branch.staff} employees` },
              { label: "Currency",    value: branch.currency },
              { label: "Timezone",    value: branch.timezone },
              { label: "Opened",      value: branch.openedDate || "—" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Contact Information</p>
            {branch.address && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm">{branch.address}</p>
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">{branch.phone}</p>
              </div>
            )}
            {branch.email && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm">{branch.email}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2">
          <Button className="flex-1 gap-1.5" variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4" />Edit
          </Button>
          <Button variant="outline" size="icon" className="text-destructive hover:text-destructive hover:border-destructive/40"
            onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Branch Card ───────────────────────────────────────────────────────────────

function BranchCard({ branch, index, onView }: { branch: Branch; index: number; onView: () => void }) {
  const typeCfg = TYPE_CONFIG[branch.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{branch.flag}</span>
          <div>
            <h3 className="font-semibold text-base">{branch.name}</h3>
            <p className="text-xs text-muted-foreground">{branch.city}, {branch.country}</p>
          </div>
        </div>
        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold",
          branch.status === "active" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-muted-foreground bg-muted")}>
          {branch.status === "active" ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mt-0.5", typeCfg.color, typeCfg.bg)}>
            {typeCfg.label}
          </span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Currency</p>
          <p className="font-medium">{branch.currency}</p>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="text-sm">{branch.staff} staff</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Manager</p>
          <p className="font-medium text-xs">{branch.manager.split(" ")[0] || "—"}</p>
        </div>
      </div>

      {branch.address && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border pt-3">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{branch.address.split(",")[0]}</span>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={onView}>View Details</Button>
    </motion.div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BranchesView() {
  const { data: branchDtos = [], isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranchMut = useDeleteBranch();

  // Map API DTOs to local view type
  const branches = React.useMemo(() => branchDtos.map(toLocalBranch), [branchDtos]);

  const [selectedBranch, setSelectedBranch] = React.useState<Branch | null>(null);
  const [showCreate,     setShowCreate]     = React.useState(false);
  const [editBranch,     setEditBranch]     = React.useState<Branch | null>(null);
  const [deleteBranch,   setDeleteBranch]   = React.useState<Branch | null>(null);

  const toRequest = (data: Omit<Branch, "id">): UpsertBranchRequest => ({
    code:       data.code,
    name:       data.name,
    type:       data.type,
    city:       data.city,
    country:    data.country,
    flag:       data.flag,
    address:    data.address  || null,
    phone:      data.phone    || null,
    email:      data.email    || null,
    manager:    data.manager  || null,
    staff:      data.staff,
    status:     data.status,
    currency:   data.currency,
    timezone:   data.timezone,
    openedDate: data.openedDate || null,
  });

  const handleCreate = (data: Omit<Branch, "id">) => {
    createBranch.mutate(toRequest(data), {
      onSuccess: () => setShowCreate(false),
    });
  };

  const handleEdit = (data: Omit<Branch, "id">) => {
    if (!editBranch) return;
    updateBranch.mutate({ id: editBranch.id, data: toRequest(data) }, {
      onSuccess: () => {
        setSelectedBranch(prev => prev?.id === editBranch.id ? { ...data, id: editBranch.id } : prev);
        setEditBranch(null);
      },
    });
  };

  const handleDelete = () => {
    if (!deleteBranch) return;
    deleteBranchMut.mutate(deleteBranch.id, {
      onSuccess: () => {
        if (selectedBranch?.id === deleteBranch.id) setSelectedBranch(null);
        setDeleteBranch(null);
      },
    });
  };

  const stats = React.useMemo(() => ({
    total: branches.length,
    active: branches.filter(b => b.status === "active").length,
    international: branches.filter(b => b.type === "international").length,
    totalStaff: branches.reduce((s, b) => s + b.staff, 0),
  }), [branches]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branch Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage office locations, staff, and regional settings.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />Add Branch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Branches", value: stats.total,         icon: Building2, color: "bg-primary/10 text-primary" },
          { label: "Active",         value: stats.active,        icon: Globe,     color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" },
          { label: "International",  value: stats.international, icon: Globe,     color: "bg-muted text-muted-foreground" },
          { label: "Total Staff",    value: stats.totalStaff,    icon: Users,     color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch, i) => (
          <BranchCard key={branch.id} branch={branch} index={i}
            onView={() => setSelectedBranch(branch)} />
        ))}
        {branches.length === 0 && (
          <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
            No branches yet. Click <strong>Add Branch</strong> to create one.
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedBranch && (
        <BranchDetailDrawer
          branch={selectedBranch}
          onClose={() => setSelectedBranch(null)}
          onEdit={() => { setEditBranch(selectedBranch); setSelectedBranch(null); }}
          onDelete={() => { setDeleteBranch(selectedBranch); setSelectedBranch(null); }}
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <BranchFormModal title="Add New Branch" onSave={handleCreate} onClose={() => setShowCreate(false)} />
        )}
        {editBranch && (
          <BranchFormModal title="Edit Branch" initial={editBranch} onSave={handleEdit} onClose={() => setEditBranch(null)} />
        )}
        {deleteBranch && (
          <ConfirmDeleteModal
            branchName={deleteBranch.name}
            onConfirm={handleDelete}
            onCancel={() => setDeleteBranch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

