"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, Search, ChefHat, Clock, Users, DollarSign,
  Package, RefreshCw, Minus, Plus, Archive, Trash2,
  CheckCircle2, AlertTriangle, BookOpen, Link2, Loader2,
} from "lucide-react";
import {
  useRecipes,
  useRecipeSummary,
  useActivateRecipe,
  useArchiveRecipe,
  useSyncCosts,
  useDeductRecipe,
  useDeleteRecipe,
} from "@/hooks/recipe/use-recipe";
import type { RecipeDto, RecipeIngredientDto } from "@/lib/recipe/recipe.api";
import { formatCurrency } from "@/lib/utils";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:   { label: "Active",   color: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  draft:    { label: "Draft",    color: "text-muted-foreground", bg: "bg-muted/20",        dot: "bg-muted-foreground" },
  archived: { label: "Archived", color: "text-warning",          bg: "bg-warning/10",     dot: "bg-warning" },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToLabel(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function PortionsBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 10 ? "text-success" : value >= 3 ? "text-warning" : "text-destructive";
  return <span className={`text-xs font-semibold ${color}`}>{value} portions</span>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent = "bg-primary",
}: {
  label: string; value: string | number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${accent}/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${accent === "bg-primary" ? "text-primary" : accent === "bg-success" ? "text-success" : "text-warning"}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onClick }: { recipe: RecipeDto; onClick: () => void }) {
  const s = STATUS_CFG[recipe.status] ?? STATUS_CFG.draft;
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-md transition-all group w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-xs font-mono text-muted-foreground mb-0.5">{recipe.recipeNumber}</p>
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
            {recipe.menuItemName}
          </p>
          {recipe.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{recipe.description}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${s.bg} ${s.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {recipe.servings} servings
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {minutesToLabel(totalTime)} total
        </span>
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          {recipe.ingredients.length} ingredients
        </span>
        <span className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" />
          {recipe.ingredients.filter(i => i.inventoryProductId).length} linked
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Cost / serving</p>
          <p className="text-sm font-bold text-foreground">{formatCurrency(recipe.costPerServing, "AED")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Can make</p>
          <PortionsBadge value={recipe.portionsCanMake} />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Ingredient Row ───────────────────────────────────────────────────────────

function IngredientRow({ ing }: { ing: RecipeIngredientDto }) {
  const hasStock = ing.stockQuantity != null;
  const low = hasStock && ing.stockQuantity! < ing.quantity;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${low ? "bg-destructive/5 border border-destructive/20" : "bg-muted/20"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-foreground font-medium">{ing.productName}</p>
          {ing.inventoryProductId && (
            <span className="inline-flex items-center gap-0.5 text-xs text-primary">
              <Link2 className="w-3 h-3" /> Linked
            </span>
          )}
          {low && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ing.quantity} {ing.unit} · {formatCurrency(ing.costPerUnit, "AED")}/{ing.unit}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-semibold text-foreground">{formatCurrency(ing.lineTotal, "AED")}</p>
        {hasStock && (
          <p className={`text-xs mt-0.5 ${low ? "text-destructive" : "text-muted-foreground"}`}>
            Stock: {ing.stockQuantity} {ing.unit}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function RecipeDrawer({
  recipe,
  onClose,
}: {
  recipe: RecipeDto;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<"overview" | "ingredients" | "instructions">("overview");
  const [portions, setPortions] = React.useState(1);
  const [deductConfirm, setDeductConfirm] = React.useState(false);

  const activate  = useActivateRecipe();
  const archive   = useArchiveRecipe();
  const syncCosts = useSyncCosts();
  const deduct    = useDeductRecipe();
  const del       = useDeleteRecipe();

  const s = STATUS_CFG[recipe.status] ?? STATUS_CFG.draft;
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const activeIngredients = recipe.ingredients.filter(i => !recipe.ingredients.find(x => x.id === i.id && x.stockQuantity === null && x.inventoryProductId === null));
  const lowStockCount = recipe.ingredients.filter(i => i.stockQuantity != null && i.stockQuantity < i.quantity).length;

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-xs font-mono text-muted-foreground">{recipe.recipeNumber}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight">{recipe.menuItemName}</p>
            {recipe.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["overview", "ingredients", "instructions"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {tab === "overview" && (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Servings",   value: recipe.servings },
                  { label: "Total Time", value: minutesToLabel(totalTime) },
                  { label: "Prep Time",  value: minutesToLabel(recipe.prepTimeMinutes) },
                  { label: "Cook Time",  value: minutesToLabel(recipe.cookTimeMinutes) },
                ].map(s => (
                  <div key={s.label} className="bg-muted/20 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Cost */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Cost Analysis</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Cost per serving</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(recipe.costPerServing, "AED")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Total ingredients</span>
                  <span className="text-sm font-semibold text-foreground">{recipe.ingredients.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Linked to inventory</span>
                  <span className="text-sm font-semibold text-foreground">
                    {recipe.ingredients.filter(i => i.inventoryProductId).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Portions can make</span>
                  <PortionsBadge value={recipe.portionsCanMake} />
                </div>
              </div>

              {/* Low stock warning */}
              {lowStockCount > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">
                    <span className="font-semibold text-destructive">{lowStockCount} ingredient{lowStockCount > 1 ? "s" : ""}</span> below required quantity.
                    Check inventory before deducting.
                  </p>
                </div>
              )}

              {/* Deduct stock */}
              <div className="bg-muted/20 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Deduct Inventory Stock</p>
                <p className="text-xs text-muted-foreground">
                  Deducts ingredient quantities from inventory proportionally for N portions.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setPortions(p => Math.max(1, p - 1))}
                      className="px-3 py-2 text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 py-2 text-sm font-semibold text-foreground min-w-[3rem] text-center">{portions}</span>
                    <button
                      onClick={() => setPortions(p => p + 1)}
                      className="px-3 py-2 text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">portions</span>
                </div>
                {!deductConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setDeductConfirm(true)}
                  >
                    <Package className="w-3.5 h-3.5 mr-1.5" />
                    Deduct {portions} Portion{portions > 1 ? "s" : ""}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive font-medium">Confirm deduction of {portions} portion{portions > 1 ? "s" : ""}?</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-destructive hover:bg-destructive/90"
                        disabled={deduct.isPending}
                        onClick={() => {
                          deduct.mutate(
                            { id: recipe.id, req: { portions } },
                            { onSuccess: () => { setDeductConfirm(false); } }
                          );
                        }}
                      >
                        {deduct.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeductConfirm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "ingredients" && (
            <>
              {recipe.ingredients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No ingredients defined</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recipe.ingredients.map(ing => (
                    <IngredientRow key={ing.id} ing={ing} />
                  ))}
                </div>
              )}

              {/* Cost total */}
              {recipe.ingredients.length > 0 && (
                <div className="bg-muted/20 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total ingredient cost</span>
                  <span className="text-sm font-bold text-foreground">
                    {formatCurrency(
                      recipe.ingredients.reduce((sum, i) => sum + i.lineTotal, 0),
                      "AED"
                    )}
                  </span>
                </div>
              )}
            </>
          )}

          {tab === "instructions" && (
            <>
              {recipe.instructions ? (
                <div className="bg-muted/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Instructions</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{recipe.instructions}</p>
                </div>
              ) : (
                <div className="bg-muted/20 rounded-xl p-4 flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  <p className="text-sm">No instructions added</p>
                </div>
              )}
              {recipe.notes && (
                <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-2">Chef Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{recipe.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          {/* Primary actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={syncCosts.isPending}
              onClick={() => syncCosts.mutate(recipe.id)}
            >
              {syncCosts.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Sync Costs
            </Button>
            {recipe.status === "draft" && (
              <Button
                size="sm"
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                disabled={activate.isPending}
                onClick={() => activate.mutate(recipe.id)}
              >
                {activate.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Activate
              </Button>
            )}
            {recipe.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-warning border-warning/30 hover:bg-warning/5"
                disabled={archive.isPending}
                onClick={() => archive.mutate(recipe.id)}
              >
                {archive.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <Archive className="w-3.5 h-3.5 mr-1.5" />}
                Archive
              </Button>
            )}
            {recipe.status === "archived" && (
              <Button
                size="sm"
                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                disabled={activate.isPending}
                onClick={() => activate.mutate(recipe.id)}
              >
                {activate.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Re-activate
              </Button>
            )}
          </div>
          {/* Danger */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/5"
              disabled={del.isPending}
              onClick={() => {
                if (confirm(`Delete recipe "${recipe.menuItemName}"? This cannot be undone.`)) {
                  del.mutate(recipe.id, { onSuccess: onClose });
                }
              }}
            >
              {del.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Close</Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RecipeSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded" />
      <div className="h-5 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-3 bg-muted rounded" />)}
      </div>
      <div className="h-px bg-border" />
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function RecipesView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "draft" | "active" | "archived">("all");
  const [selected, setSelected] = React.useState<RecipeDto | null>(null);

  const { data: summary, isLoading: summaryLoading } = useRecipeSummary();
  const { data: recipes,  isLoading: recipesLoading  } = useRecipes();

  const filtered = React.useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.menuItemName.toLowerCase().includes(q) ||
        r.recipeNumber.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [recipes, search, statusFilter]);

  const STATUS_FILTERS = [
    { value: "all",      label: "All" },
    { value: "active",   label: "Active" },
    { value: "draft",    label: "Draft" },
    { value: "archived", label: "Archived" },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Recipes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kitchen recipes linked to restaurant menu items and inventory stock
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {summaryLoading ? (
            [...Array(7)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse">
                <div className="h-8 w-8 bg-muted rounded-lg mb-3" />
                <div className="h-6 w-16 bg-muted rounded" />
              </div>
            ))
          ) : summary ? (
            <>
              <StatCard label="Total Recipes"     value={summary.total}             icon={ChefHat}      accent="bg-primary" />
              <StatCard label="Active"            value={summary.active}            icon={CheckCircle2}  accent="bg-success" />
              <StatCard label="Draft"             value={summary.draft}             icon={BookOpen}      accent="bg-primary" />
              <StatCard label="Archived"          value={summary.archived}          icon={Archive}       accent="bg-warning" />
              <StatCard label="Avg Cost/Serving"  value={formatCurrency(summary.avgCostPerServing, "AED")} icon={DollarSign} accent="bg-primary" />
              <StatCard label="Total Ingredients" value={summary.totalIngredients}  icon={Package}       accent="bg-primary" />
              <StatCard label="Linked Inventory"  value={summary.linkedToInventory} icon={Link2}         accent="bg-success" />
            </>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes, menu items…"
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f.label}
                {f.value !== "all" && summary && (
                  <span className="ml-1.5 opacity-60">
                    {f.value === "active" ? summary.active : f.value === "draft" ? summary.draft : summary.archived}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Grid */}
        {recipesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <RecipeSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ChefHat className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-foreground mb-1">No recipes found</p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter !== "all" ? "Try adjusting your filters" : "No recipes defined yet"}
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map(recipe => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelected(recipe)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <RecipeDrawer
            recipe={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
