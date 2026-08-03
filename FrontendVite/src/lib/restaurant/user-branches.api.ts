import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant/user-branches`;

export type BranchRole = "owner" | "manager" | "staff";

export interface UserBranchDto {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  role: BranchRole;
  createdAt: string;
}

export interface AddUserBranchRequest {
  userId: string;
  userName: string;
  branchId: string;
  role: BranchRole;
}

export const userBranchesApi = {
  /** The caller's own branch assignments — empty array means unrestricted (sees every branch). */
  mine: (): Promise<UserBranchDto[]> =>
    rawApiClient.get(`${BASE}/mine`),

  getAll: (userId?: string): Promise<UserBranchDto[]> =>
    rawApiClient.get(`${BASE}${userId ? `?userId=${userId}` : ""}`),

  add: (req: AddUserBranchRequest): Promise<UserBranchDto> =>
    rawApiClient.post(BASE, req),

  updateRole: (id: string, role: BranchRole): Promise<UserBranchDto> =>
    rawApiClient.put(`${BASE}/${id}`, { role }),

  remove: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/${id}`),
};
