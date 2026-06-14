import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/projectmanagement/projects`;

export type ProjectStatus = "active" | "archived";

export interface ProjectSummaryDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadName: string | null;
  totalIssues: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadName: string | null;
  nextIssueNumber: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
  leadName?: string | null;
}

export interface UpdateProjectRequest {
  name: string;
  description?: string | null;
  leadName?: string | null;
}

export const projectsApi = {
  getAll: (): Promise<ProjectSummaryDto[]> =>
    rawApiClient.get<ProjectSummaryDto[]>(BASE),

  getById: (id: string): Promise<ProjectDto> =>
    rawApiClient.get<ProjectDto>(`${BASE}/${id}`),

  create: (payload: CreateProjectRequest): Promise<ProjectDto> =>
    rawApiClient.post<ProjectDto>(BASE, payload),

  update: (id: string, payload: UpdateProjectRequest): Promise<ProjectDto> =>
    rawApiClient.put<ProjectDto>(`${BASE}/${id}`, payload),

  archive: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/archive`, {}),

  activate: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/activate`, {}),

  remove: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
