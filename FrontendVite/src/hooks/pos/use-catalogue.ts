import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catalogueApi, type ImportCatalogueRequest } from "@/lib/pos/catalogue.api";
import { productKeys } from "./use-products";
import { inventoryProductKeys } from "@/hooks/inventory/use-inventory-products";

export function useCataloguePacks(enabled = true) {
  return useQuery({
    queryKey: ["pos-catalogue", "packs"],
    queryFn:  catalogueApi.getPacks,
    enabled,
    staleTime: Infinity, // packs only change with a release
  });
}

export function useImportCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ImportCatalogueRequest) => catalogueApi.import(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      qc.invalidateQueries({ queryKey: inventoryProductKeys.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
