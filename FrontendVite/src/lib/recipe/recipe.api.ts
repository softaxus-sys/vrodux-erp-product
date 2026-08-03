import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/recipes`;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type RecipeStatus = "draft" | "active" | "archived";

export interface RecipeIngredientDto {
  id: string;
  inventoryProductId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lineTotal: number;
  stockQuantity: number | null;
  portionsCanMake: number | null;
}

export interface RecipeDto {
  id: string;
  recipeNumber: string;
  menuItemId: string;
  menuItemName: string;
  description: string | null;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  status: RecipeStatus;
  instructions: string | null;
  notes: string | null;
  createdAt: string;
  costPerServing: number;
  portionsCanMake: number | null;
  ingredients: RecipeIngredientDto[];
}

export interface RecipeSummaryDto {
  total: number;
  active: number;
  draft: number;
  archived: number;
  avgCostPerServing: number;
  totalIngredients: number;
  linkedToInventory: number;
}

export interface IngredientReq {
  inventoryProductId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
}

export interface CreateRecipeReq {
  menuItemId: string;
  menuItemName: string;
  description: string | null;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  instructions: string | null;
  notes: string | null;
  ingredients: IngredientReq[];
}

export interface DeductReq { portions: number; }

export interface FoodCostRow {
  recipeId: string;
  menuItemName: string;
  costPerServing: number;
  portionsSold: number;
  revenue: number;
  foodCost: number;
  marginPercent: number | null;
}

export interface FoodCostReport {
  from: string;
  to: string;
  items: FoodCostRow[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const recipeApi = {
  getSummary:    (): Promise<RecipeSummaryDto> =>
    rawApiClient.get<RecipeSummaryDto>(`${BASE}/summary`),

  getAll:        (): Promise<RecipeDto[]> =>
    rawApiClient.get<RecipeDto[]>(BASE),

  getById:       (id: string): Promise<RecipeDto> =>
    rawApiClient.get<RecipeDto>(`${BASE}/${id}`),

  getByMenuItem: (menuItemId: string): Promise<RecipeDto> =>
    rawApiClient.get<RecipeDto>(`${BASE}/by-menu-item/${menuItemId}`),

  create:        (req: CreateRecipeReq) =>
    rawApiClient.post<{ id: string; recipeNumber: string; menuItemName: string; costPerServing: number }>(BASE, req),

  activate:      (id: string) =>
    rawApiClient.patch<{ id: string; status: string }>(`${BASE}/${id}/activate`),

  archive:       (id: string) =>
    rawApiClient.patch<{ id: string; status: string }>(`${BASE}/${id}/archive`),

  deduct:        (id: string, req: DeductReq) =>
    rawApiClient.post<{ deducted: number; portions: number; recipeId: string }>(`${BASE}/${id}/deduct`, req),

  syncCosts:     (id: string) =>
    rawApiClient.post<{ synced: number; newCostPerServing: number }>(`${BASE}/${id}/sync-costs`),

  getFoodCostReport: (from?: string, to?: string): Promise<FoodCostReport> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return rawApiClient.get<FoodCostReport>(`${BASE}/reports/food-cost${qs ? `?${qs}` : ""}`);
  },

  delete:        (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/${id}`),
};
