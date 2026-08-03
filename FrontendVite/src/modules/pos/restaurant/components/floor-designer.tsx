import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn } from "@/lib/utils";
import {
  Plus, X, Trash2, Pencil, RotateCw, GitMerge, Unlink, Users, LayoutGrid, Loader2, QrCode,
} from "lucide-react";
import {
  useFloorLayout, useTables, useCreateFloor, useUpdateFloor, useDeleteFloor,
  useCreateDiningArea, useUpdateDiningArea, useDeleteDiningArea,
  useCreateTable, useUpdateTable, useDeleteTable, useSaveTableLayout,
  useMergeTable, useUnmergeTable, useTableQrCode,
} from "@/hooks/restaurant/use-restaurant";
import type { RestaurantTable, DiningAreaType, TableShape } from "@/lib/restaurant/restaurant.api";
import { Can, useCan } from "@/components/auth/can";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import { toast } from "sonner";

const AREA_TYPES: { value: DiningAreaType; label: string }[] = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "vip", label: "VIP" },
  { value: "bar", label: "Bar" },
  { value: "rooftop", label: "Rooftop" },
];

const SHAPES: { value: TableShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "round", label: "Round" },
  { value: "rect", label: "Rectangle" },
];

const CANVAS_W = 1400;
const CANVAS_H = 800;
const DEFAULT_SIZE = 84;

type CanvasTable = RestaurantTable & { areaId: string; areaName: string; areaType: DiningAreaType };

function defaultPos(index: number) {
  const perRow = 6;
  return { x: 40 + (index % perRow) * 150, y: 40 + Math.floor(index / perRow) * 150 };
}

export function FloorDesignerView() {
  const { data: layout = [], isLoading } = useFloorLayout();
  useRestaurantRealtime();
  const { data: allTables = [] } = useTables();
  const canEditTables = useCan("restaurant.tables.edit");

  const createFloor = useCreateFloor();
  const updateFloor = useUpdateFloor();
  const deleteFloor = useDeleteFloor();
  const createArea = useCreateDiningArea();
  const updateArea = useUpdateDiningArea();
  const deleteArea = useDeleteDiningArea();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();
  const saveLayout = useSaveTableLayout();
  const mergeTable = useMergeTable();
  const unmergeTable = useUnmergeTable();

  const [selectedFloorId, setSelectedFloorId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (layout.length && !layout.some(f => f.id === selectedFloorId)) setSelectedFloorId(layout[0].id);
  }, [layout, selectedFloorId]);

  const floor = layout.find(f => f.id === selectedFloorId);
  const tablesInFloor: CanvasTable[] = React.useMemo(
    () => (floor?.diningAreas ?? []).flatMap(a =>
      a.tables.map(t => ({ ...t, areaId: a.id, areaName: a.name, areaType: a.type }))),
    [floor],
  );
  const unassigned = React.useMemo(() => allTables.filter(t => !t.diningAreaId), [allTables]);

  // Local drag overlay — positions are only persisted on "Save Layout"
  const [localPos, setLocalPos] = React.useState<Record<string, { x: number; y: number }>>({});
  const [dirty, setDirty] = React.useState(false);
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [showAreas, setShowAreas] = React.useState(false);
  const [showAddTable, setShowAddTable] = React.useState(false);
  const [newFloorName, setNewFloorName] = React.useState("");
  const [editingFloor, setEditingFloor] = React.useState<{ id: string; name: string } | null>(null);

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<{ id: string; offX: number; offY: number; moved: boolean } | null>(null);

  const posFor = (t: CanvasTable, index: number) => {
    if (localPos[t.id]) return localPos[t.id];
    if (t.posX != null && t.posY != null) return { x: t.posX, y: t.posY };
    return defaultPos(index);
  };

  const onPointerDown = (e: React.PointerEvent, t: CanvasTable) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cur = localPos[t.id] ?? (t.posX != null && t.posY != null ? { x: t.posX, y: t.posY } : defaultPos(0));
    dragState.current = { id: t.id, offX: e.clientX - rect.left - cur.x, offY: e.clientY - rect.top - cur.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    const canvas = canvasRef.current;
    if (!ds || !canvas || !canEditTables) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(CANVAS_W - DEFAULT_SIZE, e.clientX - rect.left - ds.offX));
    const y = Math.max(0, Math.min(CANVAS_H - DEFAULT_SIZE, e.clientY - rect.top - ds.offY));
    ds.moved = true;
    setLocalPos(prev => ({ ...prev, [ds.id]: { x, y } }));
    setDirty(true);
  };

  const onPointerUp = (e: React.PointerEvent, t: CanvasTable) => {
    const ds = dragState.current;
    dragState.current = null;
    if (ds && !ds.moved) setSelectedTableId(t.id); // click, not drag → select for editing
  };

  const handleSaveLayout = () => {
    const changed = tablesInFloor.filter(t => localPos[t.id]).map(t => ({
      id: t.id, posX: localPos[t.id].x, posY: localPos[t.id].y, shape: t.shape, rotation: t.rotation,
    }));
    if (changed.length === 0) { setDirty(false); return; }
    saveLayout.mutate(changed, { onSuccess: () => { setLocalPos({}); setDirty(false); } });
  };

  const selectedTable = tablesInFloor.find(t => t.id === selectedTableId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading floor layout…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><LayoutGrid className="w-5 h-5" /> Floor & Table Designer</h1>
          <p className="text-sm text-muted-foreground">Drag tables to arrange your floor plan. Click a table to edit it.</p>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSaveLayout} disabled={saveLayout.isPending}>
            {saveLayout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Layout
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        {/* Floors sidebar */}
        <div className="w-56 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Floors</p>
          {layout.map(f => (
            <div key={f.id}
              className={cn("group flex items-center gap-1 rounded-lg border px-2 py-2 cursor-pointer",
                f.id === selectedFloorId ? "bg-primary/10 border-primary/40" : "bg-card border-border hover:bg-muted/30")}
              onClick={() => setSelectedFloorId(f.id)}>
              {editingFloor?.id === f.id ? (
                <input autoFocus value={editingFloor.name} onChange={e => setEditingFloor({ id: f.id, name: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === "Enter") { updateFloor.mutate({ id: f.id, name: editingFloor.name, sortOrder: f.sortOrder }); setEditingFloor(null); } }}
                  className="flex-1 text-sm bg-transparent border-b border-primary outline-none" />
              ) : (
                <span className="flex-1 text-sm font-medium text-foreground truncate">{f.name}</span>
              )}
              <Can permission="restaurant.tables.edit">
                <button onClick={e => { e.stopPropagation(); setEditingFloor({ id: f.id, name: f.name }); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteFloor.mutate(f.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Can>
            </div>
          ))}
          <Can permission="restaurant.tables.create">
            <div className="flex gap-1">
              <Input value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="New floor…" className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-8 px-2"
                disabled={!newFloorName.trim()}
                onClick={() => { createFloor.mutate({ name: newFloorName.trim(), sortOrder: layout.length }); setNewFloorName(""); }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Can>

          {floor && (
            <>
              <button onClick={() => setShowAreas(true)} className="text-xs text-primary hover:underline mt-3">
                Manage dining areas ({floor.diningAreas.length})
              </button>
              <Can permission="restaurant.tables.create">
                <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => setShowAddTable(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Table
                </Button>
              </Can>
            </>
          )}

          {unassigned.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-amber-500 uppercase mb-1">Unassigned ({unassigned.length})</p>
              <p className="text-[11px] text-muted-foreground mb-2">Legacy tables not yet placed on a floor.</p>
              {unassigned.map(t => (
                <button key={t.id} onClick={() => setSelectedTableId(t.id)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/30 text-foreground">
                  {t.tableNumber} · {t.section}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto border border-border rounded-xl bg-muted/10">
          {!floor ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Create a floor to start designing your layout.</div>
          ) : (
            <div ref={canvasRef} className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}
              onPointerMove={onPointerMove}>
              {tablesInFloor.map((t, i) => {
                const p = posFor(t, i);
                const isRound = t.shape === "round";
                const size = t.shape === "rect" ? { w: DEFAULT_SIZE * 1.5, h: DEFAULT_SIZE * 0.8 } : { w: DEFAULT_SIZE, h: DEFAULT_SIZE };
                return (
                  <div key={t.id}
                    onPointerDown={e => onPointerDown(e, t)}
                    onPointerUp={e => onPointerUp(e, t)}
                    style={{ position: "absolute", left: p.x, top: p.y, width: size.w, height: size.h, transform: `rotate(${t.rotation}deg)` }}
                    className={cn(
                      "flex flex-col items-center justify-center border-2 cursor-move select-none text-xs font-semibold",
                      isRound ? "rounded-full" : "rounded-lg",
                      t.id === selectedTableId ? "border-primary bg-primary/10" : "border-border bg-card",
                      t.isMerged && "opacity-50 border-dashed",
                      t.status === "occupied" && "border-amber-500/60 bg-amber-500/10",
                    )}>
                    <span>{t.tableNumber}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{t.capacity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected table detail panel */}
        {selectedTable && (
          <TableDetailPanel
            table={selectedTable}
            allTablesOnFloor={tablesInFloor.filter(t => t.id !== selectedTable.id)}
            areas={floor?.diningAreas ?? []}
            onClose={() => setSelectedTableId(null)}
            onUpdate={(p) => updateTable.mutate({ id: selectedTable.id, ...p })}
            onDelete={() => { deleteTable.mutate(selectedTable.id); setSelectedTableId(null); }}
            onMerge={(targetId) => mergeTable.mutate({ id: selectedTable.id, targetTableId: targetId })}
            onUnmerge={() => unmergeTable.mutate(selectedTable.id)}
          />
        )}

        {/* Unassigned table detail (may not be on the current floor's area list) */}
        {selectedTableId && !selectedTable && unassigned.some(t => t.id === selectedTableId) && floor && (
          <TableDetailPanel
            table={unassigned.find(t => t.id === selectedTableId)! as CanvasTable}
            allTablesOnFloor={tablesInFloor}
            areas={floor.diningAreas}
            onClose={() => setSelectedTableId(null)}
            onUpdate={(p) => updateTable.mutate({ id: selectedTableId, ...p })}
            onDelete={() => { deleteTable.mutate(selectedTableId); setSelectedTableId(null); }}
            onMerge={() => {}}
            onUnmerge={() => {}}
          />
        )}
      </div>

      {showAreas && floor && (
        <AreasModal floorId={floor.id} areas={floor.diningAreas}
          onClose={() => setShowAreas(false)}
          onCreate={(p) => createArea.mutate({ floorId: floor.id, ...p })}
          onUpdate={(id, p) => updateArea.mutate({ floorId: floor.id, id, ...p })}
          onDelete={(id) => deleteArea.mutate({ floorId: floor.id, id })}
        />
      )}

      {showAddTable && floor && (
        <AddTableModal areas={floor.diningAreas}
          onClose={() => setShowAddTable(false)}
          onCreate={(p) => { createTable.mutate(p); setShowAddTable(false); }}
        />
      )}
    </div>
  );
}

function TableDetailPanel({ table, allTablesOnFloor, areas, onClose, onUpdate, onDelete, onMerge, onUnmerge }: {
  table: CanvasTable;
  allTablesOnFloor: CanvasTable[];
  areas: { id: string; name: string }[];
  onClose: () => void;
  onUpdate: (p: { tableNumber: string; section: string; capacity: number; diningAreaId?: string | null }) => void;
  onDelete: () => void;
  onMerge: (targetId: string) => void;
  onUnmerge: () => void;
}) {
  const [tableNumber, setTableNumber] = React.useState(table.tableNumber);
  const [section, setSection] = React.useState(table.section);
  const [capacity, setCapacity] = React.useState(table.capacity);
  const [areaId, setAreaId] = React.useState(table.areaId ?? "");
  const [mergeTarget, setMergeTarget] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);

  React.useEffect(() => {
    setTableNumber(table.tableNumber); setSection(table.section); setCapacity(table.capacity); setAreaId(table.areaId ?? "");
  }, [table.id]);

  return (
    <div className="w-72 shrink-0 bg-card border border-border rounded-xl p-4 space-y-3 h-fit">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Table {table.tableNumber}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <Button size="sm" variant="outline" className="w-full" onClick={() => setShowQr(true)}>
        <QrCode className="w-3.5 h-3.5 mr-1" /> QR Ordering Code
      </Button>
      {showQr && <QrCodeModal tableId={table.id} onClose={() => setShowQr(false)} />}

      <Can permission="restaurant.tables.edit" fallback={
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Section: {table.section}</p><p>Capacity: {table.capacity}</p>
        </div>
      }>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Table Number</label>
            <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Section</label>
            <Input value={section} onChange={e => setSection(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Capacity</label>
            <Input type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="h-8 text-sm" />
          </div>
          {areas.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Dining Area</label>
              <select value={areaId} onChange={e => setAreaId(e.target.value)}
                className="w-full h-8 text-sm rounded-md border border-border bg-card px-2">
                <option value="">Unassigned</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <Button size="sm" className="w-full"
            onClick={() => onUpdate({ tableNumber, section, capacity, diningAreaId: areaId || null })}>
            Save Changes
          </Button>
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          {table.isMerged ? (
            <Button size="sm" variant="outline" className="w-full" onClick={onUnmerge}>
              <Unlink className="w-3.5 h-3.5 mr-1" /> Unmerge Table
            </Button>
          ) : allTablesOnFloor.length > 0 && (
            <div className="flex gap-1">
              <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}
                className="flex-1 h-8 text-xs rounded-md border border-border bg-card px-2">
                <option value="">Merge into…</option>
                {allTablesOnFloor.map(t => <option key={t.id} value={t.id}>{t.tableNumber}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-8 px-2" disabled={!mergeTarget}
                onClick={() => onMerge(mergeTarget)}>
                <GitMerge className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <Button size="sm" variant="outline" className="w-full text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Table
          </Button>
        </div>
      </Can>
    </div>
  );
}

function AreasModal({ floorId, areas, onClose, onCreate, onUpdate, onDelete }: {
  floorId: string;
  areas: { id: string; name: string; type: DiningAreaType; sortOrder: number }[];
  onClose: () => void;
  onCreate: (p: { name: string; type: DiningAreaType; sortOrder: number }) => void;
  onUpdate: (id: string, p: { name: string; type: DiningAreaType; sortOrder: number }) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<DiningAreaType>("indoor");
  const canEdit = useCan("restaurant.tables.edit");
  const canCreate = useCan("restaurant.tables.create");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Dining Areas</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {areas.map(a => (
          <div key={a.id} className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5">
            <Input defaultValue={a.name} className="h-7 text-xs flex-1" disabled={!canEdit}
              onBlur={e => e.target.value.trim() && e.target.value !== a.name && onUpdate(a.id, { name: e.target.value.trim(), type: a.type, sortOrder: a.sortOrder })} />
            <select defaultValue={a.type} disabled={!canEdit} className="h-7 text-xs rounded-md border border-border bg-card px-1"
              onChange={e => onUpdate(a.id, { name: a.name, type: e.target.value as DiningAreaType, sortOrder: a.sortOrder })}>
              {AREA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {canEdit && (
              <button onClick={() => onDelete(a.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
            )}
          </div>
        ))}
        {areas.length === 0 && <p className="text-xs text-muted-foreground">No dining areas yet — add one below.</p>}
      </div>

      {canCreate && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Area name…" className="h-8 text-sm flex-1" />
          <select value={type} onChange={e => setType(e.target.value as DiningAreaType)}
            className="h-8 text-sm rounded-md border border-border bg-card px-2">
            {AREA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button size="sm" disabled={!name.trim()}
            onClick={() => { onCreate({ name: name.trim(), type, sortOrder: areas.length }); setName(""); }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </LeftDrawer>
  );
}

function AddTableModal({ areas, onClose, onCreate }: {
  areas: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (p: { tableNumber: string; section: string; capacity: number; diningAreaId?: string | null }) => void;
}) {
  const [tableNumber, setTableNumber] = React.useState("");
  const [section, setSection] = React.useState("indoor");
  const [capacity, setCapacity] = React.useState(4);
  const [areaId, setAreaId] = React.useState(areas[0]?.id ?? "");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Add Table</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Table Number</label>
        <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="T-12" className="h-9 text-sm" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Section</label>
        <Input value={section} onChange={e => setSection(e.target.value)} className="h-9 text-sm" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Capacity</label>
        <Input type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="h-9 text-sm" />
      </div>
      {areas.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Dining Area</label>
          <select value={areaId} onChange={e => setAreaId(e.target.value)}
            className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <Button className="w-full" disabled={!tableNumber.trim() || !section.trim()}
        onClick={() => onCreate({ tableNumber: tableNumber.trim(), section: section.trim(), capacity, diningAreaId: areaId || null })}>
        <Plus className="w-4 h-4 mr-1" /> Add Table
      </Button>
    </LeftDrawer>
  );
}

function QrCodeModal({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const { data, isLoading } = useTableQrCode(tableId);
  const [kioskMode, setKioskMode] = React.useState(false);
  const url = data ? (kioskMode ? `${data.url}?kiosk=1` : data.url) : "";

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-xs">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">QR Ordering Code</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        {isLoading || !data ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto my-8" />
        ) : (
          <>
            <img src={data.qrImageDataUri} alt="Table QR code" className="mx-auto w-48 h-48" />
            <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={kioskMode} onChange={e => setKioskMode(e.target.checked)} />
              Kiosk mode (for a self-order kiosk device, not a guest's phone)
            </label>
            <p className="text-xs text-muted-foreground break-all">{url}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1"
                onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied."); }}>
                Copy Link
              </Button>
              <Button size="sm" className="flex-1" onClick={() => window.open(url, "_blank")}>
                Preview
              </Button>
            </div>
          </>
        )}
      </div>
    </LeftDrawer>
  );
}
