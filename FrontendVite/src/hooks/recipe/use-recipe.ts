import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recipeApi, type CreateRecipeReq, type DeductReq } from "@/lib/recipe/recipe.api";
import { toast } from "sonner";

export const recipeKeys = {
  all:      ["recipes"] as const,
  summary:  () => [...recipeKeys.all, "summary"] as const,
  list:     () => [...recipeKeys.all, "list"] as const,
  detail:   (id: string) => [...recipeKeys.all, "detail", id] as const,
  foodCost: (from?: string, to?: string) => [...recipeKeys.all, "food-cost", from ?? null, to ?? null] as const,
};

export const useRecipeSummary = () =>
  useQuery({ queryKey: recipeKeys.summary(), queryFn: recipeApi.getSummary });

export const useRecipes = (enabled = true) =>
  useQuery({ queryKey: recipeKeys.list(), queryFn: recipeApi.getAll, enabled });

export const useRecipe = (id: string) =>
  useQuery({ queryKey: recipeKeys.detail(id), queryFn: () => recipeApi.getById(id), enabled: !!id });

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateRecipeReq) => recipeApi.create(req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: recipeKeys.all }); toast.success("Recipe created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useActivateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: recipeKeys.all }); toast.success("Recipe activated — stock will now auto-deduct when served."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: recipeKeys.all }); toast.success("Recipe archived."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeductRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: DeductReq }) => recipeApi.deduct(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.syncCosts(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: recipeKeys.all }); toast.success("Ingredient costs synced from inventory."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useFoodCostReport = (from?: string, to?: string) =>
  useQuery({ queryKey: recipeKeys.foodCost(from, to), queryFn: () => recipeApi.getFoodCostReport(from, to) });

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: recipeKeys.all }); toast.success("Recipe deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
