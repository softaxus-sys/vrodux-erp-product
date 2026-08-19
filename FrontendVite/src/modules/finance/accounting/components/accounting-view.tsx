import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, TrendingUp, TrendingDown, Scale, DollarSign, X, ChevronRight,
  Pencil, Trash2, ListTree, GripVertical,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { AccountDto as Account, AccountTypeDto } from "@/lib/finance/finance.api";
import {
  useAccounts, useAccountingSummary,
  useCreateAccount, useUpdateAccount, useDeleteAccount,
  useAccountTypes, useCreateAccountType, useUpdateAccountType, useDeleteAccountType, useReorderAccountTypes,
} from "@/hooks/finance/use-finance";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import type { CreateAccountRequest } from "@/lib/finance/finance.api";
import { Can } from "@/components/auth/can";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Cycling color palette applied to root account Types in display order. */
const TYPE_PALETTE = [
  { text: "text-success",     bg: "bg-success/10 text-success" },
  { text: "text-destructive", bg: "bg-destructive/10 text-destructive" },
  { text: "text-primary",     bg: "bg-primary/10 text-primary" },
  { text: "text-amber-500",   bg: "bg-amber-500/10 text-amber-500" },
  { text: "text-violet-500",  bg: "bg-violet-500/10 text-violet-500" },
  { text: "text-cyan-500",    bg: "bg-cyan-500/10 text-cyan-500" },
];

// ── Account Type tree helpers ───────────────────────────────────────────────────

interface AccountTypeNode extends AccountTypeDto {
  subtypes: AccountTypeDto[];
}

/** Builds a 2-level Type -> Subtype tree from the flat account-types list, ordered by sortOrder. */
function buildTypeTree(types: AccountTypeDto[]): AccountTypeNode[] {
  const roots = types
    .filter((t) => !t.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return roots.map((root) => ({
    ...root,
    subtypes: types
      .filter((t) => t.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

/** Resolves the AccountType (root or subtype) id an account belongs to, falling back to the legacy root code. */
function resolveAccountTypeId(account: Account, types: AccountTypeDto[]): string {
  if (account.accountTypeId) return account.accountTypeId;
  const root = types.find((t) => !t.parentId && t.code === account.accountType);
  return root?.id ?? "";
}

// ── Hierarchy helpers ─────────────────────────────────────────────────────────

interface AccountNode extends Account {
  children: AccountNode[];
  depth:    number;
}

/** Builds a parent->child tree from a flat list, ordered by account number at every level. */
function buildAccountTree(list: Account[]): AccountNode[] {
  const byId = new Map<string, AccountNode>();
  for (const a of list) byId.set(a.id, { ...a, children: [], depth: 0 });

  const roots: AccountNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const assignDepth = (nodes: AccountNode[], depth: number) => {
    nodes.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    for (const n of nodes) {
      n.depth = depth;
      assignDepth(n.children, depth + 1);
    }
  };
  assignDepth(roots, 0);
  return roots;
}

/** Flattens a tree into display order, skipping the subtrees of collapsed nodes. */
function flattenAccountTree(nodes: AccountNode[], collapsed: Set<string>): AccountNode[] {
  const out: AccountNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children.length && !collapsed.has(n.id)) out.push(...flattenAccountTree(n.children, collapsed));
  }
  return out;
}

// ── Account Drawer ─────────────────────────────────────────────────────────────

function AccountDrawer({
  account, accounts, accountTypes, onClose, onEdit, onDelete,
}: {
  account: Account;
  accounts: Account[];
  accountTypes: AccountTypeDto[];
  onClose: () => void;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const parentAccount = account.parentId
    ? accounts.find((a) => a.id === account.parentId)
    : null;

  const children = accounts.filter((a) => a.parentId === account.id);

  const typeTree = React.useMemo(() => buildTypeTree(accountTypes), [accountTypes]);
  const rootIndexByTypeId = React.useMemo(() => {
    const m = new Map<string, number>();
    typeTree.forEach((root, idx) => {
      m.set(root.id, idx);
      root.subtypes.forEach((st) => m.set(st.id, idx));
    });
    return m;
  }, [typeTree]);
  const typesById = React.useMemo(() => new Map(accountTypes.map((t) => [t.id, t])), [accountTypes]);

  const getTypeName = (a: Account) => {
    const typeId = resolveAccountTypeId(a, accountTypes);
    return typesById.get(typeId)?.name ?? a.accountType;
  };
  const getTypeColor = (a: Account) => {
    const typeId = resolveAccountTypeId(a, accountTypes);
    const idx = rootIndexByTypeId.get(typeId) ?? 0;
    return TYPE_PALETTE[idx % TYPE_PALETTE.length];
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("accounting.drawer.detail")}</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(account)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(account)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{account.accountNumber}</p>
              <h2 className="text-xl font-bold mt-0.5">{account.name}</h2>
              {account.description && (
                <p className="text-sm text-muted-foreground mt-1">{account.description}</p>
              )}
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold shrink-0", getTypeColor(account).bg)}>
              {getTypeName(account)}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">{t("accounting.drawer.currentBalance")}</p>
            <p className={cn("text-3xl font-bold", account.balance >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(Math.abs(account.balance), currency)}
            </p>
            {account.balance < 0 && <p className="text-xs text-muted-foreground mt-1">{t("accounting.drawer.creditBalance")}</p>}
          </div>

          <div className="space-y-0 divide-y divide-border/50">
            {[
              { label: t("accounting.drawer.accountNumber"), value: account.accountNumber },
              { label: t("accounting.drawer.accountType"),   value: getTypeName(account) },
              { label: t("accounting.drawer.status"),        value: account.isActive ? t("accounting.status.active") : t("accounting.status.inactive") },
              { label: t("accounting.drawer.parentAccount"), value: parentAccount
                  ? `${parentAccount.accountNumber} — ${parentAccount.name}`
                  : t("accounting.drawer.rootAccount") },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>

          {children.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">{t("accounting.drawer.childAccounts")}</h3>
              <div className="space-y-2">
                {children.map((child) => (
                  <div key={child.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{child.accountNumber}</span>
                      <span className="text-sm">{child.name}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", getTypeColor(child).text)}>
                      {formatCurrency(child.balance, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Account Form Modal ─────────────────────────────────────────────────────────

function AccountFormModal({
  accounts,
  accountTypes,
  editAccount,
  onClose,
}: {
  accounts: Account[];
  accountTypes: AccountTypeDto[];
  editAccount: Account | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("finance");
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const isEdit = Boolean(editAccount);

  const typeTree = React.useMemo(() => buildTypeTree(accountTypes), [accountTypes]);
  const rootIndexByTypeId = React.useMemo(() => {
    const m = new Map<string, number>();
    typeTree.forEach((root, idx) => {
      m.set(root.id, idx);
      root.subtypes.forEach((st) => m.set(st.id, idx));
    });
    return m;
  }, [typeTree]);

  const defaultTypeId = editAccount
    ? resolveAccountTypeId(editAccount, accountTypes)
    : (typeTree.find((t) => t.isActive)?.id ?? "");

  const [form, setForm] = React.useState<CreateAccountRequest>({
    accountNumber: editAccount?.accountNumber ?? "",
    name:          editAccount?.name ?? "",
    accountTypeId: defaultTypeId,
    description:   editAccount?.description ?? "",
    parentId:      editAccount?.parentId ?? null,
    isActive:      editAccount?.isActive ?? true,
  });

  const set = (k: keyof typeof form, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Parent-account choices, grouped by root account Type and indented to reflect
  // the existing hierarchy. Excludes the account being edited and all of its
  // descendants (no cycles).
  const parentOptionsByRoot = React.useMemo(() => {
    const excluded = new Set<string>();
    if (editAccount) {
      const collectDescendants = (id: string) => {
        excluded.add(id);
        for (const a of accounts) if (a.parentId === id) collectDescendants(a.id);
      };
      collectDescendants(editAccount.id);
    }
    const eligible = accounts.filter((a) => !excluded.has(a.id));

    const result = new Map<string, AccountNode[]>();
    for (const root of typeTree) {
      const list = eligible.filter(
        (a) => rootIndexByTypeId.get(resolveAccountTypeId(a, accountTypes)) === rootIndexByTypeId.get(root.id)
      );
      if (list.length) result.set(root.id, flattenAccountTree(buildAccountTree(list), new Set()));
    }
    return result;
  }, [accounts, accountTypes, editAccount, typeTree, rootIndexByTypeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && editAccount) {
      await updateMutation.mutateAsync({ id: editAccount.id, data: form });
      toast.success(t("accounting.form.updated"));
    } else {
      await createMutation.mutateAsync(form);
      toast.success(t("accounting.form.created"));
    }
    onClose();
  };

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-bold">{isEdit ? t("accounting.form.editTitle") : t("accounting.form.newTitle")}</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("accounting.form.accountNumber")}</label>
                <Input
                  placeholder={t("accounting.form.accountNumberPh")}
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("accounting.form.type")}</label>
                <select
                  value={form.accountTypeId}
                  onChange={(e) => set("accountTypeId", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                >
                  <option value="" disabled>{t("accounting.form.selectType")}</option>
                  {typeTree.filter((rt) => rt.isActive).map((root) => (
                    <optgroup key={root.id} label={root.name}>
                      <option value={root.id}>{root.subtypes.length > 0 ? t("accounting.form.general") : root.name}</option>
                      {root.subtypes.filter((s) => s.isActive).map((sub) => (
                        <option key={sub.id} value={sub.id}>{"  "}{sub.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("accounting.form.accountName")}</label>
              <Input
                placeholder={t("accounting.form.accountNamePh")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("accounting.form.parentAccount")}</label>
              <select
                value={form.parentId ?? ""}
                onChange={(e) => set("parentId", e.target.value || null)}
                className="w-full h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t("accounting.form.rootOption")}</option>
                {typeTree.map((root) => {
                  const opts = parentOptionsByRoot.get(root.id);
                  if (!opts?.length) return null;
                  return (
                    <optgroup key={root.id} label={root.name}>
                      {opts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {"  ".repeat(a.depth)}{a.accountNumber} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("accounting.form.description")}</label>
              <Input
                placeholder={t("accounting.form.descriptionPh")}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive ?? true}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 rounded border border-input"
              />
              <label htmlFor="isActive" className="text-sm">{t("accounting.form.active")}</label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t("common:action.cancel")}</Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("common:action.saving") : isEdit ? t("accounting.form.saveChanges") : t("accounting.form.createAccount")}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Manage Account Types Modal ─────────────────────────────────────────────────

function SortableTypeRow({
  id, children,
}: {
  id: string;
  children: (handle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

function AccountTypesModal({
  accountTypes, onClose,
}: {
  accountTypes: AccountTypeDto[];
  onClose: () => void;
}) {
  const { t } = useTranslation("finance");
  const createType   = useCreateAccountType();
  const updateType   = useUpdateAccountType();
  const deleteType   = useDeleteAccountType();
  const reorderTypes = useReorderAccountTypes();

  const typeTree = React.useMemo(() => buildTypeTree(accountTypes), [accountTypes]);

  const [addingRoot, setAddingRoot]   = React.useState(false);
  const [newRootName, setNewRootName] = React.useState("");
  const [newRootBalance, setNewRootBalance] = React.useState<"debit" | "credit">("debit");

  const [addingSubFor, setAddingSubFor] = React.useState<string | null>(null);
  const [newSubName, setNewSubName]     = React.useState("");

  const [editingId, setEditingId]     = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");

  const [pendingDelete, setPendingDelete] = React.useState<AccountTypeDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRootDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = typeTree.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const reordered = arrayMove(typeTree, oldIndex, newIndex);
    reorderTypes.mutate(reordered.map((t, i) => ({ id: t.id, sortOrder: i + 1 })));
  };

  const handleSubDragEnd = (subtypes: AccountTypeDto[]) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = subtypes.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const reordered = arrayMove(subtypes, oldIndex, newIndex);
    reorderTypes.mutate(reordered.map((t, i) => ({ id: t.id, sortOrder: i + 1 })));
  };

  const handleAddRoot = async () => {
    if (!newRootName.trim()) return;
    try {
      await createType.mutateAsync({ name: newRootName.trim(), normalBalance: newRootBalance });
      setNewRootName(""); setAddingRoot(false);
    } catch { /* toast already shown */ }
  };

  const handleAddSub = async (parentId: string) => {
    if (!newSubName.trim()) return;
    try {
      await createType.mutateAsync({ name: newSubName.trim(), parentId });
      setNewSubName(""); setAddingSubFor(null);
    } catch { /* toast already shown */ }
  };

  const startRename = (t: AccountTypeDto) => {
    setEditingId(t.id);
    setEditingName(t.name);
  };

  const handleRename = async (t: AccountTypeDto) => {
    if (!editingName.trim()) return;
    try {
      await updateType.mutateAsync({
        id: t.id,
        data: { name: editingName.trim(), normalBalance: t.normalBalance, isActive: t.isActive },
      });
      setEditingId(null);
    } catch { /* toast already shown */ }
  };

  const handleToggleActive = async (t: AccountTypeDto) => {
    try {
      await updateType.mutateAsync({
        id: t.id,
        data: { name: t.name, normalBalance: t.normalBalance, isActive: !t.isActive },
      });
    } catch { /* toast already shown */ }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteType.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch { /* toast already shown */ }
  };

  const renderRow = (
    at: AccountTypeDto,
    opts: { handle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }; isSub: boolean }
  ) => {
    const isEditing = editingId === at.id;
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card",
          opts.isSub && "ml-8"
        )}
      >
        <button
          {...opts.handle.attributes}
          {...opts.handle.listeners}
          style={{ touchAction: "none" }}
          className="text-muted-foreground hover:text-foreground cursor-grab shrink-0"
          aria-label={t("accounting.types.dragToReorder")}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {isEditing ? (
          <Input
            autoFocus
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleRename(at); if (e.key === "Escape") setEditingId(null); }}
            className="h-8 flex-1"
          />
        ) : (
          <span className={cn("flex-1 text-sm", !at.isActive && "text-muted-foreground line-through")}>{at.name}</span>
        )}

        {!at.parentId && (
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
            at.normalBalance === "debit" ? "bg-primary/10 text-primary" : "bg-violet-500/10 text-violet-500"
          )}>
            {t(`accounting.types.${at.normalBalance}`, { defaultValue: at.normalBalance })}
          </span>
        )}

        {!at.isActive && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground shrink-0">
            {t("accounting.types.inactive")}
          </span>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRename(at)}>
                <Plus className="h-3.5 w-3.5 rotate-45" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleToggleActive(at)}>
                {at.isActive ? t("accounting.types.deactivate") : t("accounting.types.activate")}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => startRename(at)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setPendingDelete(at)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-bold">{t("accounting.types.title")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("accounting.types.subtitle")}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
              <SortableContext items={typeTree.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {typeTree.map((root) => (
                    <div key={root.id} className="space-y-2">
                      <SortableTypeRow id={root.id}>
                        {(handle) => renderRow(root, { handle, isSub: false })}
                      </SortableTypeRow>

                      {root.subtypes.length > 0 && (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd(root.subtypes)}>
                          <SortableContext items={root.subtypes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {root.subtypes.map((sub) => (
                                <SortableTypeRow key={sub.id} id={sub.id}>
                                  {(handle) => renderRow(sub, { handle, isSub: true })}
                                </SortableTypeRow>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}

                      {addingSubFor === root.id ? (
                        <div className="ml-8 flex items-center gap-2">
                          <Input
                            autoFocus
                            placeholder={t("accounting.types.subtypeNamePh")}
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleAddSub(root.id); if (e.key === "Escape") setAddingSubFor(null); }}
                            className="h-8 flex-1"
                          />
                          <Button size="sm" className="h-8" onClick={() => handleAddSub(root.id)} disabled={createType.isPending}>{t("accounting.types.add")}</Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => { setAddingSubFor(null); setNewSubName(""); }}>{t("common:action.cancel")}</Button>
                        </div>
                      ) : (
                        <button
                          className="ml-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => { setAddingSubFor(root.id); setNewSubName(""); }}
                        >
                          <Plus className="h-3 w-3" /> {t("accounting.types.addSubtype")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {addingRoot ? (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Input
                  autoFocus
                  placeholder={t("accounting.types.typeNamePh")}
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddRoot(); if (e.key === "Escape") setAddingRoot(false); }}
                  className="h-9 flex-1"
                />
                <select
                  value={newRootBalance}
                  onChange={(e) => setNewRootBalance(e.target.value as "debit" | "credit")}
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="debit">{t("accounting.types.debit")}</option>
                  <option value="credit">{t("accounting.types.credit")}</option>
                </select>
                <Button size="sm" onClick={handleAddRoot} disabled={createType.isPending}>{t("accounting.types.add")}</Button>
                <Button size="sm" variant="outline" onClick={() => { setAddingRoot(false); setNewRootName(""); }}>{t("common:action.cancel")}</Button>
              </div>
            ) : (
              <button
                className="w-full pt-2 border-t border-border text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-2"
                onClick={() => setAddingRoot(true)}
              >
                <Plus className="h-4 w-4" /> {t("accounting.types.addType")}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => setPendingDelete(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold">{t("accounting.types.deleteTitle", { name: pendingDelete.name })}</h3>
              <p className="text-sm text-muted-foreground">
                {t("accounting.types.deleteBody")}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDelete(null)}>{t("common:action.cancel")}</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteType.isPending}>
                  {deleteType.isPending ? t("common:action.deleting") : t("common:action.delete")}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Account Section (Type or Subtype bucket) ────────────────────────────────────

function AccountSection({
  label, color, accounts, search, depthMap, collapsed, onToggleCollapse, onSelect,
  isCollapsed, onToggleSection, currency, showHeader = true,
}: {
  label: string;
  color: { text: string; bg: string };
  accounts: Account[];
  search: string;
  depthMap: Map<string, number>;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (a: Account) => void;
  isCollapsed: boolean;
  onToggleSection: () => void;
  currency: string;
  showHeader?: boolean;
}) {
  const { t } = useTranslation("finance");
  const tree = React.useMemo(() => buildAccountTree(accounts), [accounts]);
  const rows = search
    ? accounts.map((a): AccountNode => ({ ...a, children: [], depth: depthMap.get(a.id) ?? 0 }))
    : flattenAccountTree(tree, collapsed);

  const subtotal = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {showHeader && (
        <button
          onClick={onToggleSection}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", color.bg)}>{label}</span>
            <span className="text-xs text-muted-foreground">{t("accounting.accountsCount", { count: accounts.length })}</span>
          </div>
          <span className={cn("text-sm font-bold", color.text)}>
            {t("accounting.subtotal", { amount: formatCurrency(subtotal, currency) })}
          </span>
        </button>
      )}

      {!isCollapsed && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">{t("accounting.table.code")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("accounting.table.accountName")}</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("accounting.table.description")}</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">{t("accounting.table.status")}</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40">{t("accounting.table.balance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => (
              <tr
                key={account.id}
                onClick={() => onSelect(account)}
                className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {account.accountNumber}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  <div className="flex items-center gap-1" style={{ paddingLeft: `${account.depth * 20}px` }}>
                    {!search && account.children.length > 0 ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(account.id); }}
                        className="p-0.5 rounded hover:bg-muted shrink-0"
                        aria-label={collapsed.has(account.id) ? t("accounting.expand") : t("accounting.collapse")}
                      >
                        <ChevronRight className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          !collapsed.has(account.id) && "rotate-90"
                        )} />
                      </button>
                    ) : (
                      <span className="w-[18px] shrink-0" />
                    )}
                    <span className={cn(account.depth === 0 && "font-semibold")}>{account.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[240px] truncate">
                  {account.description}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    account.isActive
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {account.isActive ? t("accounting.status.active") : t("accounting.status.inactive")}
                  </span>
                </td>
                <td className={cn("px-4 py-3 text-right text-sm font-semibold", color.text)}>
                  {formatCurrency(Math.abs(account.balance), currency)}
                  {account.balance < 0 && <span className="text-xs ml-1">{t("accounting.crMark")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function AccountingView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: accounts = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();

  const exportCsv = () => {
    const csv = toCsv(accounts.map(a => ({
      "Account #":  a.accountNumber,
      "Name":       a.name,
      "Type":       a.accountType,
      "Balance":    a.balance,
      "Active":     a.isActive ? "Yes" : "No",
      "Description":a.description ?? "",
    })), ["Account #","Name","Type","Balance","Active","Description"]);
    downloadFile(`chart_of_accounts_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Chart of Accounts",
    subtitle: `${accounts.length} accounts`,
    columns: ["Account #","Name","Type","Balance (AED)","Active","Description"],
    rows: accounts.map(a => [a.accountNumber, a.name, a.accountType, a.balance, a.isActive ? "Yes" : "No", a.description ?? ""]),
  });
  const { data: accountingSummary } = useAccountingSummary();
  const deleteMutation = useDeleteAccount();
  const reorderTypes = useReorderAccountTypes();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const STAT_CARDS = [
    { label: t("accounting.stat.totalAssets"),      value: accountingSummary?.totalAssets      ?? 0, color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: t("accounting.stat.totalLiabilities"), value: accountingSummary?.totalLiabilities ?? 0, color: "text-destructive", icon: TrendingDown,  bg: "bg-destructive/10" },
    { label: t("accounting.stat.equity"),           value: accountingSummary?.totalEquity      ?? 0, color: "text-primary",     icon: Scale,         bg: "bg-primary/10" },
    { label: t("accounting.stat.revenueYtd"),       value: accountingSummary?.totalRevenue     ?? 0, color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: t("accounting.stat.expensesYtd"),      value: accountingSummary?.totalExpenses    ?? 0, color: "text-destructive", icon: TrendingDown,  bg: "bg-destructive/10" },
    { label: t("accounting.stat.netProfit"),        value: accountingSummary?.netProfit        ?? 0, color: "text-success",     icon: DollarSign,   bg: "bg-success/10" },
  ];

  const [search, setSearch] = React.useState("");
  const [activeRootId, setActiveRootId] = React.useState<string | "all">("all");
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);
  const [pendingAccountDelete, setPendingAccountDelete] = React.useState<Account | null>(null);
  const [editAccount, setEditAccount] = React.useState<Account | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [showManageTypes, setShowManageTypes] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeTree = React.useMemo(() => buildTypeTree(accountTypes), [accountTypes]);

  const rootIndexByTypeId = React.useMemo(() => {
    const m = new Map<string, number>();
    typeTree.forEach((root, idx) => {
      m.set(root.id, idx);
      root.subtypes.forEach((st) => m.set(st.id, idx));
    });
    return m;
  }, [typeTree]);

  // Depth of each account in the full hierarchy (independent of search/filters),
  // used to indent rows when a search collapses the tree to a flat match list.
  const depthMap = React.useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const cache = new Map<string, number>();
    const depthOf = (a: Account, seen: Set<string>): number => {
      if (cache.has(a.id)) return cache.get(a.id)!;
      const parent = a.parentId ? byId.get(a.parentId) : undefined;
      const depth = !parent || seen.has(a.id) ? 0 : depthOf(parent, new Set(seen).add(a.id)) + 1;
      cache.set(a.id, depth);
      return depth;
    };
    for (const a of accounts) depthOf(a, new Set());
    return cache;
  }, [accounts]);

  const filtered = React.useMemo(() => {
    return accounts.filter((a) => {
      const typeId = resolveAccountTypeId(a, accountTypes);
      const matchType = activeRootId === "all" || rootIndexByTypeId.get(typeId) === rootIndexByTypeId.get(activeRootId);
      const matchSearch =
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.accountNumber.includes(search);
      return matchType && matchSearch;
    });
  }, [accounts, accountTypes, search, activeRootId, rootIndexByTypeId]);

  // Bucket filtered accounts by the AccountType (root or subtype) they belong to.
  const accountsByTypeId = React.useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const a of filtered) {
      const typeId = resolveAccountTypeId(a, accountTypes);
      if (!map.has(typeId)) map.set(typeId, []);
      map.get(typeId)!.push(a);
    }
    return map;
  }, [filtered, accountTypes]);

  const handleEdit = (a: Account) => {
    setSelectedAccount(null);
    setEditAccount(a);
    setShowForm(true);
  };

  const activeRoots = React.useMemo(() => typeTree.filter((t) => t.isActive), [typeTree]);

  const handleRootDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = activeRoots.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const reordered = arrayMove(activeRoots, oldIndex, newIndex);
    reorderTypes.mutate(reordered.map((t, i) => ({ id: t.id, sortOrder: i + 1 })));
  };

  const handleDelete = (a: Account) => setPendingAccountDelete(a);

  const confirmAccountDelete = async () => {
    if (!pendingAccountDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingAccountDelete.id);
      toast.success(t("accounting.deleteAccount.deleted"));
      setPendingAccountDelete(null);
      setSelectedAccount(null);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? t("accounting.deleteAccount.deleteFailed"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("accounting.title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t("accounting.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} className="gap-2" />
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowManageTypes(true)}>
            <ListTree className="h-4 w-4" /> {t("accounting.manageTypes")}
          </Button>
          <Can permission="finance.accounting.create">
            <Button size="sm" className="gap-2"
              onClick={() => { setEditAccount(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> {t("accounting.newAccount")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>
              {formatCurrency(card.value, currency)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("accounting.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveRootId("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              activeRootId === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t("accounting.all")}
          </button>
          {activeRoots.map((root) => (
            <button
              key={root.id}
              onClick={() => setActiveRootId(root.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeRootId === root.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {root.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
      <SortableContext items={activeRoots.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-4">
        {activeRoots.map((root, idx) => {
          const color = TYPE_PALETTE[idx % TYPE_PALETTE.length];
          const generalAccounts = accountsByTypeId.get(root.id) ?? [];
          const totalCount = generalAccounts.length
            + root.subtypes.reduce((s, sub) => s + (accountsByTypeId.get(sub.id)?.length ?? 0), 0);

          if (search && totalCount === 0) return null;

          const allRootAccounts = [
            ...generalAccounts,
            ...root.subtypes.flatMap((sub) => accountsByTypeId.get(sub.id) ?? []),
          ];
          const rootSubtotal = allRootAccounts.reduce((s, a) => s + a.balance, 0);
          const isRootCollapsed = collapsedSections.has(root.id);

          return (
            <SortableTypeRow key={root.id} id={root.id}>
              {({ attributes, listeners }) => (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/40 border-b border-border transition-colors"
              >
                <button
                  onClick={() => toggleSection(root.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !isRootCollapsed && "rotate-90")} />
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", color.bg)}>
                    {root.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("accounting.accountsCount", { count: totalCount })}</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-bold", color.text)}>
                    {t("accounting.subtotal", { amount: formatCurrency(rootSubtotal, currency) })}
                  </span>
                  <button
                    {...attributes}
                    {...(listeners ?? {})}
                    className="p-1 -mr-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing touch-none"
                    aria-label={t("accounting.dragToReorderNamed", { name: root.name })}
                    title={t("accounting.dragToReorder")}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {!isRootCollapsed && (
                <div className="p-3 space-y-3">
                  {generalAccounts.length > 0 && (
                    root.subtypes.length > 0 ? (
                      <AccountSection
                        label={t("accounting.general")}
                        color={color}
                        accounts={generalAccounts}
                        search={search}
                        depthMap={depthMap}
                        collapsed={collapsed}
                        onToggleCollapse={toggleCollapse}
                        onSelect={setSelectedAccount}
                        isCollapsed={collapsedSections.has(`${root.id}:general`)}
                        onToggleSection={() => toggleSection(`${root.id}:general`)}
                        currency={currency}
                      />
                    ) : (
                      <AccountSection
                        label={root.name}
                        color={color}
                        accounts={generalAccounts}
                        search={search}
                        depthMap={depthMap}
                        collapsed={collapsed}
                        onToggleCollapse={toggleCollapse}
                        onSelect={setSelectedAccount}
                        isCollapsed={false}
                        onToggleSection={() => {}}
                        currency={currency}
                        showHeader={false}
                      />
                    )
                  )}

                  {root.subtypes.map((sub) => {
                    const subAccounts = accountsByTypeId.get(sub.id) ?? [];
                    if (subAccounts.length === 0) return null;
                    return (
                      <AccountSection
                        key={sub.id}
                        label={sub.name}
                        color={color}
                        accounts={subAccounts}
                        search={search}
                        depthMap={depthMap}
                        collapsed={collapsed}
                        onToggleCollapse={toggleCollapse}
                        onSelect={setSelectedAccount}
                        isCollapsed={collapsedSections.has(sub.id)}
                        onToggleSection={() => toggleSection(sub.id)}
                        currency={currency}
                      />
                    );
                  })}

                  {totalCount === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("accounting.noAccountsInType")}</p>
                  )}
                </div>
              )}
            </div>
              )}
            </SortableTypeRow>
          );
        })}
      </div>
      </SortableContext>
      </DndContext>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedAccount && (
          <AccountDrawer
            account={selectedAccount}
            accounts={accounts}
            accountTypes={accountTypes}
            onClose={() => setSelectedAccount(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <AccountFormModal
            accounts={accounts}
            accountTypes={accountTypes}
            editAccount={editAccount}
            onClose={() => { setShowForm(false); setEditAccount(null); }}
          />
        )}
      </AnimatePresence>

      {/* Manage Account Types Modal */}
      <AnimatePresence>
        {showManageTypes && (
          <AccountTypesModal
            accountTypes={accountTypes}
            onClose={() => setShowManageTypes(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete account confirmation */}
      <AnimatePresence>
        {pendingAccountDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
              onClick={() => setPendingAccountDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-bold">{t("accounting.deleteAccount.title", { name: pendingAccountDelete.name })}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("accounting.deleteAccount.body", { number: pendingAccountDelete.accountNumber })}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPendingAccountDelete(null)}>{t("common:action.cancel")}</Button>
                  <Button variant="destructive" onClick={confirmAccountDelete} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? t("common:action.deleting") : t("common:action.delete")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
