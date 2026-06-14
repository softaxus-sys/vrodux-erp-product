import { rawApiClient } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = (projectId: string) => `${API}/api/projectmanagement/projects/${projectId}/sprints`;

export type SprintStatus = "planned" | "active" | "completed";

export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  sortOrder: number;
  issueCount: number;
}

export interface CreateSprintRequest {
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSprintRequest {
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export const sprintsApi = {
  getAll: (projectId: string): Promise<SprintDto[]> =>
    rawApiClient.get<SprintDto[]>(BASE(projectId)),

  create: (projectId: string, payload: CreateSprintRequest): Promise<SprintDto> =>
    rawApiClient.post<SprintDto>(BASE(projectId), payload),

  update: (projectId: string, id: string, payload: UpdateSprintRequest): Promise<SprintDto> =>
    rawApiClient.put<SprintDto>(`${BASE(projectId)}/${id}`, payload),

  start: (projectId: string, id: string): Promise<SprintDto> =>
    rawApiClient.post<SprintDto>(`${BASE(projectId)}/${id}/start`, {}),

  complete: (projectId: string, id: string): Promise<SprintDto> =>
    rawApiClient.post<SprintDto>(`${BASE(projectId)}/${id}/complete`, {}),

  remove: (projectId: string, id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE(projectId)}/${id}`),
};
