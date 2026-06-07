import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/branches`;

export interface BranchDto {
  id:          string;
  code:        string;
  name:        string;
  type:        string;
  city:        string;
  country:     string;
  flag:        string;
  address:     string | null;
  phone:       string | null;
  email:       string | null;
  manager:     string | null;
  staff:       number;
  status:      string;
  currency:    string;
  timezone:    string;
  openedDate:  string | null;
  createdAt:   string;
  updatedAt:   string | null;
}

export interface BranchesPage {
  items:      BranchDto[];
  page:       number;
  pageSize:   number;
  totalCount: number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface UpsertBranchRequest {
  code:       string;
  name:       string;
  type?:      string | null;
  city?:      string | null;
  country?:   string | null;
  flag?:      string | null;
  address?:   string | null;
  phone?:     string | null;
  email?:     string | null;
  manager?:   string | null;
  staff:      number;
  status?:    string | null;
  currency?:  string | null;
  timezone?:  string | null;
  openedDate?: string | null;
}

export const branchesApi = {
  getAll: (page = 1, pageSize = 50, status?: string): Promise<BranchesPage> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    return apiClient.get(`${BASE}?${params}`);
  },

  getById: (id: string): Promise<BranchDto> =>
    apiClient.get(`${BASE}/${id}`),

  create: (data: UpsertBranchRequest): Promise<BranchDto> =>
    apiClient.post(BASE, data),

  update: (id: string, data: UpsertBranchRequest): Promise<BranchDto> =>
    apiClient.put(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}`),
};
