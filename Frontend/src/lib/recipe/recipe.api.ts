import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/recipes`;

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

// ─── Request types ────────────────────────────────────────────────────────────

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

export interface DeductReq {
  portions: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

export const recipeApi = {
  getSummary: (): Promise<RecipeSummaryDto> =>
    rawApiClient.get<RecipeSummaryDto>(`${BASE}/summary`),

  getAll: (): Promise<RecipeDto[]> =>
    rawApiClient.get<RecipeDto[]>(BASE),

  getById: (id: string): Promise<RecipeDto> =>
    rawApiClient.get<RecipeDto>(`${BASE}/${id}`),

  getByMenuItem: (menuItemId: string): Promise<RecipeDto> =>
    rawApiClient.get<RecipeDto>(`${BASE}/by-menu-item/${menuItemId}`),

  create: (req: CreateRecipeReq): Promise<{ id: string; recipeNumber: string; menuItemName: string; costPerServing: number }> =>
    rawApiClient.post(`${BASE}`, req),

  activate: (id: string): Promise<{ id: string; status: string }> =>
    rawApiClient.patch(`${BASE}/${id}/activate`),

  archive: (id: string): Promise<{ id: string; status: string }> =>
    rawApiClient.patch(`${BASE}/${id}/archive`),

  deduct: (id: string, req: DeductReq): Promise<{ deducted: number; portions: number; recipeId: string }> =>
    rawApiClient.post(`${BASE}/${id}/deduct`, req),

  syncCosts: (id: string): Promise<{ synced: number; newCostPerServing: number }> =>
    rawApiClient.post(`${BASE}/${id}/sync-costs`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/${id}`),
};
