import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recipeApi, type CreateRecipeReq, type DeductReq } from "@/lib/recipe/recipe.api";

export const recipeKeys = {
  all:     ["recipes"] as const,
  summary: () => [...recipeKeys.all, "summary"] as const,
  list:    () => [...recipeKeys.all, "list"] as const,
  detail:  (id: string) => [...recipeKeys.all, "detail", id] as const,
};

export function useRecipeSummary() {
  return useQuery({
    queryKey: recipeKeys.summary(),
    queryFn:  () => recipeApi.getSummary(),
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: recipeKeys.list(),
    queryFn:  () => recipeApi.getAll(),
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn:  () => recipeApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateRecipeReq) => recipeApi.create(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

export function useActivateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

export function useArchiveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

export function useDeductRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: DeductReq }) =>
      recipeApi.deduct(id, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

export function useSyncCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.syncCosts(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}
