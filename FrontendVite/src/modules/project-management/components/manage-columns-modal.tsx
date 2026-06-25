import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Plus, Pencil, Trash2, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useBoardColumns, useCreateBoardColumn, useUpdateBoardColumn, useDeleteBoardColumn, useReorderBoardColumns,
} from "@/hooks/project-management/use-board-columns";
import type { BoardColumnDto } from "@/lib/project-management/board-columns.api";
import { useAuthStore } from "@/store/auth.store";

interface ManageColumnsModalProps {
  projectId: string;
  onClose: () => void;
}

function SortableColumnRow({ id, children }: { id: string; children: (handle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners })}</div>;
}

export function ManageColumnsModal({ projectId, onClose }: ManageColumnsModalProps) {
  const { hasRawPermission } = useAuthStore();
  const canCreate = hasRawPermission("project-management.boards.create");
  const canEdit = hasRawPermission("project-management.boards.edit");
  const canDelete = hasRawPermission("project-management.boards.delete");

  const { data: columns = [], isLoading } = useBoardColumns(projectId);
  const createColumn = useCreateBoardColumn(projectId);
  const updateColumn = useUpdateBoardColumn(projectId);
  const deleteColumn = useDeleteBoardColumn(projectId);
  const reorderColumns = useReorderBoardColumns(projectId);

  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<BoardColumnDto | null>(null);

  const sorted = [...columns].sort((a, b) => a.sortOrder - b.sortOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = sorted.map(c => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderColumns.mutate({ items: reordered.map((c, i) => ({ id: c.id, sortOrder: i + 1 })) });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createColumn.mutateAsync({ name: newName.trim(), category: "todo" });
      setNewName(""); setAdding(false);
    } catch { /* hook toasts the error */ }
  };

  const startEdit = (c: BoardColumnDto) => { setEditingId(c.id); setEditingName(c.name); };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      await updateColumn.mutateAsync({ id: editingId, payload: { name: editingName.trim() } });
      setEditingId(null);
    } catch { /* hook toasts the error */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold">Manage Columns</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading columns…</span>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={canEdit ? handleDragEnd : undefined}>
              <SortableContext items={sorted.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sorted.map(c => (
                    <SortableColumnRow key={c.id} id={c.id}>
                      {({ attributes, listeners }) => (
                        <div className="flex items-center gap-2 bg-muted/20 border border-border rounded-lg px-2 py-2">
                          {canEdit && (
                            <button {...attributes} {...listeners} className="p-1 cursor-grab text-muted-foreground touch-none">
                              <GripVertical className="h-4 w-4" />
                            </button>
                          )}
                          {editingId === c.id ? (
                            <Input value={editingName} onChange={e => setEditingName(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && saveEdit()}
                              className="h-8 text-sm flex-1" autoFocus />
                          ) : (
                            <span className="flex-1 text-sm font-medium">{c.name}</span>
                          )}
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">{c.category.replace("_", " ")}</span>
                          {canEdit && (editingId === c.id ? (
                            <button onClick={saveEdit} className="p-1.5 rounded-lg hover:bg-success/10 text-success"><Check className="h-3.5 w-3.5" /></button>
                          ) : (
                            <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          ))}
                          {canDelete && !c.isDefault && (
                            <button onClick={() => setPendingDelete(c)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </SortableColumnRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {canCreate && (adding ? (
            <div className="flex items-center gap-2 pt-1">
              <Input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Column name" className="h-8 text-sm flex-1" autoFocus />
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createColumn.isPending}>Add</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Column
            </button>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {pendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Delete Column?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">"{pendingDelete.name}" can only be removed if it has no issues.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => { deleteColumn.mutate(pendingDelete.id); setPendingDelete(null); }} disabled={deleteColumn.isPending}>
                  {deleteColumn.isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
