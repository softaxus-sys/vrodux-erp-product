import * as React from "react";
import { motion } from "framer-motion";
import {
  Plus, Building2, CheckCircle, Star, ArrowUpDown,
  Search, Phone, User, MapPin, Loader2, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useWarehouses, useCreateWarehouse, useUpdateWarehouse,
  useSetDefaultWarehouse, useDeleteWarehouse,
} from "@/hooks/inventory/use-warehouses";
import type { WarehouseDto } from "@/lib/inventory/types";
import { ClientPagination, useClientPagination } from "@/components/ui/client-pagination";

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface WarehouseFormProps {
  initial?: WarehouseDto | null;
  onSave:   (data: {
    name: string; code: string; address: string;
    contactPerson: string; phone: string; isActive: boolean;
  }) => void;
  onCancel: () => void;
  saving:   boolean;
}

function WarehouseForm({ initial, onSave, onCancel, saving }: WarehouseFormProps) {
  const [name,          setName]          = React.useState(initial?.name          ?? "");
  const [code,          setCode]          = React.useState(initial?.code          ?? "");
  const [address,       setAddress]       = React.useState(initial?.address       ?? "");
  const [contactPerson, setContactPerson] = React.useState(initial?.contactPerson ?? "");
  const [phone,         setPhone]         = React.useState(initial?.phone         ?? "");
  const [isActive,      setIsActive]      = React.useState(initial?.isActive      ?? true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Warehouse name is required."); return; }
    onSave({ name, code, address, contactPerson, phone, isActive });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-enterprise-lg"
      >
        <h2 className="text-lg font-bold mb-4">{initial ? "Edit Warehouse" : "Add Warehouse"}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Main Warehouse" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Code</label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="WH-001" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 0000000" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Karachi, Pakistan" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contact Person</label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="John Doe" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <label htmlFor="isActive" className="text-sm">Active</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function WarehousesView() {
  const { data: warehouses = [], isLoading } = useWarehouses();
  const createWarehouse   = useCreateWarehouse();
  const updateWarehouse   = useUpdateWarehouse();
  const setDefault        = useSetDefaultWarehouse();
  const deleteWarehouse   = useDeleteWarehouse();

  const [search,    setSearch]    = React.useState("");
  const [showForm,  setShowForm]  = React.useState(false);
  const [editing,   setEditing]   = React.useState<WarehouseDto | null>(null);
  const [deleteId,  setDeleteId]  = React.useState<string | null>(null);

  const filtered = React.useMemo(() =>
    warehouses.filter(w =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (w.address ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [warehouses, search]
  );

  const pg = useClientPagination(filtered, 12);

  const active   = warehouses.filter(w => w.isActive).length;
  const inactive = warehouses.filter(w => !w.isActive).length;
  const defaultW = warehouses.find(w => w.isDefault);

  function handleSave(data: { name: string; code: string; address: string; contactPerson: string; phone: string; isActive: boolean }) {
    if (editing) {
      updateWarehouse.mutate({ id: editing.id, data }, { onSuccess: () => { setEditing(null); } });
    } else {
      createWarehouse.mutate(data, { onSuccess: () => { setShowForm(false); } });
    }
  }

  const saving = createWarehouse.isPending || updateWarehouse.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage storage locations, contact info, and default warehouse.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add Warehouse
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",    value: warehouses.length,     icon: Building2,   color: "text-primary",     bg: "bg-primary/10" },
          { label: "Active",   value: active,                icon: CheckCircle, color: "text-success",     bg: "bg-success/10" },
          { label: "Inactive", value: inactive,              icon: Building2,   color: "text-muted-foreground", bg: "bg-muted" },
          { label: "Movements",value: warehouses.reduce((a, w) => a + (w.movementCount ?? 0), 0), icon: ArrowUpDown, color: "text-warning", bg: "bg-warning/10" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-3", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search warehouses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pg.pageItems.map((w, idx) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {w.code && (
                      <span className="text-xs font-mono text-muted-foreground">{w.code}</span>
                    )}
                    {w.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold truncate">{w.name}</h3>
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2",
                  w.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {w.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {w.address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{w.address}</span>
                  </div>
                )}
                {w.contactPerson && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{w.contactPerson}</span>
                  </div>
                )}
                {w.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{w.phone}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Movements</p>
                  <p className="text-sm font-bold">{(w.movementCount ?? 0).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!w.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDefault.mutate(w.id)}
                      title="Set as default"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditing(w)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(w.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && !isLoading && (
            <div className="col-span-3 bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No warehouses found.</p>
            </div>
          )}
        </div>
      )}

      <ClientPagination
        page={pg.page} totalPages={pg.totalPages} totalCount={pg.totalCount}
        hasPrev={pg.hasPrev} hasNext={pg.hasNext}
        onPrev={() => pg.setPage(p => p - 1)} onNext={() => pg.setPage(p => p + 1)}
        label="warehouses"
      />

      {/* Add / Edit form */}
      {(showForm || editing) && (
        <WarehouseForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
          >
            <h3 className="font-bold text-lg mb-2">Delete Warehouse?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteWarehouse.isPending}
                onClick={() => deleteWarehouse.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
              >
                {deleteWarehouse.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
