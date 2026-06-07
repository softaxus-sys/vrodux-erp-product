"use client";

import * as React from "react";
import { Search, Package, ChefHat, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import type { RecipeIngredientDto } from "@/lib/recipe/recipe.api";
import { formatCurrency } from "@/lib/utils";

interface FlatIngredient extends RecipeIngredientDto {
  recipeId: string;
  recipeName: string;
}

export function IngredientsView() {
  const { data: recipes, isLoading, isError } = useRecipes();
  const [search, setSearch] = React.useState("");

  const ingredients: FlatIngredient[] = React.useMemo(() => {
    if (!recipes) return [];
    return recipes.flatMap(r =>
      r.ingredients.map(ing => ({
        ...ing,
        recipeId:    r.id,
        recipeName:  r.menuItemName,
      }))
    );
  }, [recipes]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter(
      i =>
        i.productName.toLowerCase().includes(q) ||
        i.recipeName.toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
    );
  }, [ingredients, search]);

  // Aggregate by productName for summary
  const uniqueProducts = React.useMemo(() => {
    const map = new Map<string, { name: string; usedInCount: number; totalQty: number; unit: string }>();
    for (const ing of ingredients) {
      const existing = map.get(ing.productName);
      if (existing) {
        existing.usedInCount += 1;
        existing.totalQty    += ing.quantity;
      } else {
        map.set(ing.productName, { name: ing.productName, usedInCount: 1, totalQty: ing.quantity, unit: ing.unit });
      }
    }
    return map.size;
  }, [ingredients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="animate-spin mr-2 h-5 w-5" />
        Loading ingredients…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive gap-2">
        <AlertCircle className="h-5 w-5" />
        Failed to load ingredients.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Ingredients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All ingredients across {recipes?.length ?? 0} recipes — {uniqueProducts} unique products
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search ingredients or recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ingredient</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recipe</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost / Unit</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Line Total</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inventory</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <ChefHat className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  No ingredients found
                </td>
              </tr>
            ) : (
              filtered.map(ing => (
                <tr key={`${ing.recipeId}-${ing.id}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{ing.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.recipeName}</td>
                  <td className="px-4 py-3 text-right">{ing.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.unit}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(ing.costPerUnit)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(ing.lineTotal)}</td>
                  <td className="px-4 py-3 text-right">
                    {ing.stockQuantity != null ? (
                      <span className={ing.stockQuantity < ing.quantity ? "text-destructive font-medium" : "text-success"}>
                        {ing.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ing.inventoryProductId ? (
                      <Badge variant="outline" className="text-success border-success/30 bg-success/5 text-xs">Linked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">Manual</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
