import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChefHat, Clock, Users, DollarSign, Package, RefreshCw, Minus, Plus, Archive, Trash2, CheckCircle2, AlertTriangle, BookOpen, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecipes, useRecipeSummary, useActivateRecipe, useArchiveRecipe, useSyncCosts, useDeductRecipe, useDeleteRecipe } from "@/hooks/recipe/use-recipe";
import type { RecipeDto, RecipeIngredientDto } from "@/lib/recipe/recipe.api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:   { label: "Active",   color: "text-success",          bg: "bg-success/10",  dot: "bg-success" },
  draft:    { label: "Draft",    color: "text-muted-foreground", bg: "bg-muted/20",    dot: "bg-muted-foreground" },
  archived: { label: "Archived", color: "text-warning",          bg: "bg-warning/10",  dot: "bg-warning" },
} as const;

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Ingredient row ───────────────────────────────────────────────────────────

function IngredientRow({ ing }: { ing: RecipeIngredientDto }) {
  const low = ing.stockQuantity != null && ing.stockQuantity < ing.quantity;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {ing.inventoryProductId
          ? <Link2 className="h-3 w-3 text-success shrink-0" />
          : <Package className="h-3 w-3 text-muted-foreground shrink-0" />}
        <span className="text-sm truncate">{ing.productName}</span>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-sm">
        <span className="text-muted-foreground">{ing.quantity} {ing.unit}</span>
        {ing.stockQuantity != null && (
          <span className={low ? "text-destructive font-medium" : "text-success"}>
            {low && <AlertTriangle className="h-3 w-3 inline mr-1" />}
            {ing.stockQuantity} in stock
          </span>
        )}
        <span className="font-medium">{formatCurrency(ing.lineTotal)}</span>
      </div>
    </div>
  );
}

// ─── Recipe card ──────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onSelect }: { recipe: RecipeDto; onSelect: (r: RecipeDto) => void }) {
  const cfg = STATUS_CFG[recipe.status];
  const hasLowStock = recipe.ingredients.some(i => i.stockQuantity != null && i.stockQuantity < i.quantity);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={() => onSelect(recipe)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {recipe.menuItemName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{recipe.recipeNumber}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasLowStock && (
            <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" /> Low stock
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {recipe.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{recipe.description}</p>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { icon: Clock,      val: `${recipe.prepTimeMinutes + recipe.cookTimeMinutes}m`, label: "Total Time" },
          { icon: Users,      val: recipe.servings,                                        label: "Servings" },
          { icon: DollarSign, val: formatCurrency(recipe.costPerServing),                  label: "Cost/Serving" },
          { icon: Package,    val: recipe.portionsCanMake ?? "—",                          label: "Can Make" },
        ].map(({ icon: Icon, val, label }) => (
          <div key={label} className="bg-muted/30 rounded-lg p-2">
            <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-semibold">{val}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
        <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? "s" : ""}</span>
        <span>{recipe.ingredients.filter(i => i.inventoryProductId).length} linked to inventory</span>
      </div>
    </motion.div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function RecipeDetail({ recipe, onClose }: { recipe: RecipeDto; onClose: () => void }) {
  const activate  = useActivateRecipe();
  const archive   = useArchiveRecipe();
  const syncCosts = useSyncCosts();
  const deduct    = useDeductRecipe();
  const del       = useDeleteRecipe();
  const [portions, setPortions] = React.useState(1);

  const handleDeduct = async () => {
    await deduct.mutateAsync({ id: recipe.id, req: { portions } });
    toast.success(`Deducted ${portions} portion(s) from inventory`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border rounded-xl p-6 space-y-5 h-fit sticky top-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{recipe.menuItemName}</h3>
          <p className="text-xs text-muted-foreground">{recipe.recipeNumber}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {recipe.description && (
        <p className="text-sm text-muted-foreground">{recipe.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: "Prep Time",    value: `${recipe.prepTimeMinutes}m` },
          { label: "Cook Time",    value: `${recipe.cookTimeMinutes}m` },
          { label: "Servings",     value: recipe.servings },
          { label: "Cost/Serving", value: formatCurrency(recipe.costPerServing) },
          { label: "Can Make",     value: `${recipe.portionsCanMake ?? "—"} portions` },
          { label: "Status",       value: STATUS_CFG[recipe.status].label },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Ingredients
        </h4>
        <div>
          {recipe.ingredients.map(ing => <IngredientRow key={ing.id} ing={ing} />)}
        </div>
      </div>

      {/* Deduct */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deduct Stock</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPortions(p => Math.max(1, p - 1))} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-10 text-center font-semibold">{portions}</span>
          <button onClick={() => setPortions(p => p + 1)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Plus className="h-3 w-3" />
          </button>
          <Button size="sm" onClick={handleDeduct} disabled={deduct.isPending} className="flex-1">
            {deduct.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Deduct"}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => syncCosts.mutateAsync(recipe.id)} disabled={syncCosts.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncCosts.isPending ? "animate-spin" : ""}`} /> Sync Costs
        </Button>
        {recipe.status === "draft" && (
          <Button size="sm" variant="outline" onClick={() => activate.mutateAsync(recipe.id)} disabled={activate.isPending} className="text-success border-success/30 hover:bg-success/5">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Activate
          </Button>
        )}
        {recipe.status === "active" && (
          <Button size="sm" variant="outline" onClick={() => archive.mutateAsync(recipe.id)} disabled={archive.isPending}>
            <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => del.mutateAsync(recipe.id)} disabled={del.isPending} className="text-destructive border-destructive/30 hover:bg-destructive/5">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function RecipesView() {
  const { data: recipes, isLoading } = useRecipes();
  const { data: summary } = useRecipeSummary();
  const [search, setSearch]   = React.useState("");
  const [filter, setFilter]   = React.useState<"all" | "active" | "draft" | "archived">("all");
  const [selected, setSelected] = React.useState<RecipeDto | null>(null);

  const filtered = React.useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => {
      const matchSearch = !search || r.menuItemName.toLowerCase().includes(search.toLowerCase()) || r.recipeNumber.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || r.status === filter;
      return matchSearch && matchFilter;
    });
  }, [recipes, search, filter]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" /> Recipes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage recipes, ingredients, and production costs
          </p>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={BookOpen}   label="Total Recipes"    value={summary.total}                          sub={`${summary.active} active`} />
          <StatCard icon={Package}    label="Ingredients"      value={summary.totalIngredients}               sub={`${summary.linkedToInventory} linked`} />
          <StatCard icon={DollarSign} label="Avg Cost/Serving" value={formatCurrency(summary.avgCostPerServing)} />
          <StatCard icon={ChefHat}    label="Draft"            value={summary.draft}                          sub={`${summary.archived} archived`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "draft", "archived"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid + Detail */}
      <div className={`grid gap-6 ${selected ? "grid-cols-1 lg:grid-cols-[1fr_380px]" : "grid-cols-1"}`}>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading recipes…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ChefHat className="h-10 w-10 mb-3 opacity-20" />
              <p>No recipes found</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${selected ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
              <AnimatePresence mode="popLayout">
                {filtered.map(r => (
                  <RecipeCard key={r.id} recipe={r} onSelect={setSelected} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <RecipeDetail recipe={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
