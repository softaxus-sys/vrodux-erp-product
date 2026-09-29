import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/catalogue`;

export interface CatalogueCategoryDto { name: string; count: number }

export interface CataloguePackDto {
  country: string;
  countryName: string;
  industry: string;
  industryLabel: string;
  productCount: number;
  /** Suggested default tax rate (%) for the country. */
  taxRate: number;
  builtAt: string;
  source: string;
  categories: CatalogueCategoryDto[];
}

export interface ImportCatalogueRequest {
  country: string;
  industry: string;
  /** Omit / empty = every category in the pack. */
  categories?: string[];
  taxRate: number;
  trackInventory?: boolean;
}

export interface ImportCatalogueResultDto {
  imported: number;
  skippedExisting: number;
  skippedInvalid: number;
  categoriesCreated: number;
}

export const catalogueApi = {
  getPacks: (): Promise<CataloguePackDto[]> =>
    apiClient.get<CataloguePackDto[]>(`${BASE}/packs`),

  import: (req: ImportCatalogueRequest): Promise<ImportCatalogueResultDto> =>
    apiClient.post<ImportCatalogueResultDto>(`${BASE}/import`, req),
};
