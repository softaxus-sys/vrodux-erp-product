import { useQuery } from "@tanstack/react-query";
import { fileManagerApi, type DocumentLibraryFilters } from "@/lib/file-manager.api";

export function useDocumentLibrary(filters: DocumentLibraryFilters, enabled = true) {
  return useQuery({
    queryKey: ["file-manager", "library", filters],
    queryFn: () => fileManagerApi.search(filters),
    enabled,
  });
}
