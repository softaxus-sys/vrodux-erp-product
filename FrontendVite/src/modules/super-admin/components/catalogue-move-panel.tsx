import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, PackageSearch, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { catalogueMoveApi, type Clash, type MovePreview } from "@/lib/admin/catalogue-move.api";

const STATE_LABEL = {
  on_pos: "In the POS tables",
  on_inventory: "In Inventory",
  empty: "No products yet",
} as const;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function ClashTable({ title, rows, what }: { title: string; rows: Clash[]; what: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-destructive">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{what}</th>
              <th className="px-3 py-2 text-left font-semibold">POS product</th>
              <th className="px-3 py-2 text-left font-semibold">Inventory product</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.slice(0, 50).map(c => (
              <tr key={c.posProductId + c.inventoryProductId}>
                <td className="px-3 py-1.5 font-mono">{c.value}</td>
                <td className="px-3 py-1.5">{c.posName}</td>
                <td className="px-3 py-1.5">{c.inventoryName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 50 && <p className="text-[11px] text-muted-foreground">Showing 50 of {rows.length}.</p>}
    </div>
  );
}

/**
 * Super-admin card: where a workspace's product catalogue lives, a dry run of moving it into Inventory,
 * and the move itself. The move is one transaction and keeps every product id; nothing is deleted.
 */
export function CatalogueMovePanel({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["catalogue-move", tenantId], queryFn: () => catalogueMoveApi.status(tenantId) });
  const [preview, setPreview] = React.useState<MovePreview | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  const check = useMutation({
    mutationFn: () => catalogueMoveApi.preview(tenantId),
    onSuccess: p => { setPreview(p); setConfirm(false); setTyped(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: () => catalogueMoveApi.run(tenantId),
    onSuccess: r => {
      toast.success(`Moved ${r.productsMoved} product${r.productsMoved === 1 ? "" : "s"} to Inventory.`);
      setPreview(null); setConfirm(false); setTyped("");
      qc.invalidateQueries({ queryKey: ["catalogue-move", tenantId] });
    },
    onError: (e: Error) => { toast.error(e.message); setConfirm(false); },
  });

  const s = status.data;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><PackageSearch className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h3 className="text-base font-bold">Product catalogue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventory is the single source of truth for products and stock. A workspace whose products still sit in the POS tables
            keeps working exactly as before until it is moved here.
          </p>
        </div>
      </div>

      {status.isLoading && <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {status.isError && <p className="text-sm text-destructive">{(status.error as Error).message}</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Catalogue is" value={<span className={cn("text-base", s.state === "on_pos" && "text-warning")}>{STATE_LABEL[s.state]}</span>} />
            <Stat label="Products in POS tables" value={s.posProducts} />
            <Stat label="Products in Inventory" value={s.inventoryProducts} />
          </div>

          {s.lastMove && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <p>
                Moved on {new Date(s.lastMove.movedAt).toLocaleString()} by {s.lastMove.movedBy}: {s.lastMove.productsMoved} products
                {s.lastMove.alreadyThere > 0 && `, ${s.lastMove.alreadyThere} already in Inventory`}, {s.lastMove.categoriesCreated} categories created,
                {" "}{s.lastMove.warehousesCreated} warehouses created, {s.lastMove.stockBuckets} stock lines. The POS rows were kept, marked as moved.
              </p>
            </div>
          )}

          {s.state === "on_pos" && !preview && (
            <Button onClick={() => check.mutate()} disabled={check.isPending} className="gap-2">
              {check.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
              Check what a move would do
            </Button>
          )}
          {s.state !== "on_pos" && !s.lastMove && (
            <p className="text-xs text-muted-foreground">There is nothing to move for this workspace.</p>
          )}
        </>
      )}

      {preview && (
        <div className="space-y-4 border-t border-border pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Products to move" value={preview.counts.posProducts - preview.counts.alreadyInInventory} />
            <Stat label="Categories to create" value={`${preview.counts.categoriesToCreate} of ${preview.counts.categoriesUsed}`} />
            <Stat label="Head-office units" value={preview.headOfficeUnits} />
            <Stat label="Branch units" value={preview.branchUnits} />
          </div>

          {preview.blockers.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <p className="text-xs font-bold text-destructive flex items-center gap-1.5"><XCircle className="h-4 w-4" />This cannot be moved yet</p>
              <ul className="space-y-1">{preview.blockers.map(b => <li key={b} className="text-xs">{b}</li>)}</ul>
            </div>
          )}
          <ClashTable title="SKU already used by a different Inventory product" rows={preview.skuClashes} what="SKU" />
          <ClashTable title="Barcode already used by a different Inventory product" rows={preview.barcodeClashes} what="Barcode" />

          {preview.warnings.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-1.5">
              <p className="text-xs font-bold text-warning flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />Worth knowing</p>
              <ul className="space-y-1 list-disc ps-4">{preview.warnings.map(w => <li key={w} className="text-xs">{w}</li>)}</ul>
            </div>
          )}

          {preview.branches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Branches holding their own stock</p>
              <ul className="text-xs divide-y divide-border rounded-lg border border-border">
                {preview.branches.map(b => (
                  <li key={b.branchId} className="px-3 py-2 flex justify-between gap-3">
                    <span>{b.name}</span>
                    <span className="text-muted-foreground tabular-nums">{b.products} products · {b.units} units · {b.hasWarehouse ? "has a warehouse" : "warehouse will be created"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending || run.isPending}>
              {check.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />}Check again
            </Button>
            {preview.canMove && !confirm && (
              <Button onClick={() => setConfirm(true)} className="gap-2"><DatabaseZap className="h-4 w-4" />Move to Inventory…</Button>
            )}
          </div>

          {preview.canMove && confirm && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm">
                This moves <strong>{preview.counts.posProducts - preview.counts.alreadyInInventory}</strong> products of <strong>{tenantName}</strong> into
                Inventory in one step. Product ids are kept and the POS rows are marked as moved, not deleted. Do it outside trading hours. Type the workspace name to confirm.
              </p>
              <Input value={typed} onChange={e => setTyped(e.target.value)} placeholder={tenantName} className="h-9 max-w-sm" />
              <div className="flex gap-2">
                <Button disabled={typed.trim().toLowerCase() !== tenantName.trim().toLowerCase() || run.isPending} onClick={() => run.mutate()}>
                  {run.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />}Move catalogue
                </Button>
                <Button variant="outline" onClick={() => { setConfirm(false); setTyped(""); }} disabled={run.isPending}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
