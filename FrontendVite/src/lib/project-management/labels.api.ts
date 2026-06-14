import { rawApiClient } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = (projectId: string) => `${API}/api/projectmanagement/projects/${projectId}/labels`;

export interface LabelDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface CreateLabelRequest {
  name: string;
  color?: string;
}

export interface UpdateLabelRequest {
  name: string;
  color: string;
}

export const labelsApi = {
  getAll: (projectId: string): Promise<LabelDto[]> =>
    rawApiClient.get<LabelDto[]>(BASE(projectId)),

  create: (projectId: string, payload: CreateLabelRequest): Promise<LabelDto> =>
    rawApiClient.post<LabelDto>(BASE(projectId), payload),

  update: (projectId: string, id: string, payload: UpdateLabelRequest): Promise<LabelDto> =>
    rawApiClient.put<LabelDto>(`${BASE(projectId)}/${id}`, payload),

  remove: (projectId: string, id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE(projectId)}/${id}`),
};
