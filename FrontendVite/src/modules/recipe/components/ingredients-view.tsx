import * as React from "react";
import { Search, Package, ChefHat, Loader2, AlertCircle, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import type { RecipeIngredientDto } from "@/lib/recipe/recipe.api";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

interface FlatIngredient extends RecipeIngredientDto {
  recipeId:   string;
  recipeName: string;
}

export function IngredientsView() {
  const currency = useCurrency();
  const { data: recipes, isLoading, isError } = useRecipes();
  const [search, setSearch] = React.useState("");

  const ingredients: FlatIngredient[] = React.useMemo(() =>
    (recipes ?? []).flatMap(r => r.ingredients.map(ing => ({ ...ing, recipeId: r.id, recipeName: r.menuItemName }))),
    [recipes]
  );

  const uniqueProducts = React.useMemo(() =>
    new Set(ingredients.map(i => i.productName)).size,
    [ingredients]
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return q ? ingredients.filter(i => i.productName.toLowerCase().includes(q) || i.recipeName.toLowerCase().includes(q)) : ingredients;
  }, [ingredients, search]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="animate-spin mr-2 h-5 w-5" /> Loading…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 text-destructive gap-2">
      <AlertCircle className="h-5 w-5" /> Failed to load ingredients.
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Ingredients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {recipes?.length ?? 0} recipes · {uniqueProducts} unique products · {ingredients.length} total lines
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search ingredients or recipes…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {["Ingredient", "Recipe", "Qty", "Unit", "Cost/Unit", "Line Total", "Stock", "Inventory"].map(h => (
                <th key={h} className={`px-4 py-3 font-medium text-muted-foreground ${h === "Ingredient" || h === "Recipe" ? "text-left" : "text-right"} ${h === "Unit" || h === "Inventory" ? "text-left" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <ChefHat className="mx-auto h-8 w-8 mb-2 opacity-20" />
                  No ingredients found
                </td>
              </tr>
            ) : filtered.map(ing => {
              const low = ing.stockQuantity != null && ing.stockQuantity < ing.quantity;
              return (
                <tr key={`${ing.recipeId}-${ing.id}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{ing.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.recipeName}</td>
                  <td className="px-4 py-3 text-right">{ing.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ing.costPerUnit, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(ing.lineTotal, currency)}</td>
                  <td className="px-4 py-3 text-right">
                    {ing.stockQuantity != null
                      ? <span className={low ? "text-destructive font-medium" : "text-success"}>{ing.stockQuantity}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {ing.inventoryProductId
                      ? <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full"><Link2 className="h-2.5 w-2.5" />Linked</span>
                      : <span className="inline-flex items-center text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">Manual</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
