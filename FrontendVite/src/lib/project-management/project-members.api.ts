import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/projectmanagement/projects`;

export type ProjectMemberRole = "owner" | "member" | "viewer";

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  role: ProjectMemberRole;
  createdAt: string;
}

export interface AddProjectMemberRequest {
  userId: string;
  userName: string;
  userEmail?: string | null;
  role: ProjectMemberRole;
}

export const projectMembersApi = {
  getAll: (projectId: string): Promise<ProjectMemberDto[]> =>
    rawApiClient.get<ProjectMemberDto[]>(`${BASE}/${projectId}/members`),

  add: (projectId: string, payload: AddProjectMemberRequest): Promise<ProjectMemberDto> =>
    rawApiClient.post<ProjectMemberDto>(`${BASE}/${projectId}/members`, payload),

  updateRole: (projectId: string, memberId: string, role: ProjectMemberRole): Promise<ProjectMemberDto> =>
    rawApiClient.put<ProjectMemberDto>(`${BASE}/${projectId}/members/${memberId}`, { role }),

  remove: (projectId: string, memberId: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${projectId}/members/${memberId}`),
};
