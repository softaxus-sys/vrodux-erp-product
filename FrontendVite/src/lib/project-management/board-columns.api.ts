import { rawApiClient } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = (projectId: string) => `${API}/api/projectmanagement/projects/${projectId}/columns`;

export type BoardColumnCategory = "backlog" | "todo" | "in_progress" | "done";

export interface BoardColumnDto {
  id: string;
  projectId: string;
  name: string;
  category: BoardColumnCategory;
  sortOrder: number;
  isDefault: boolean;
}

export interface CreateBoardColumnRequest {
  name: string;
  category?: BoardColumnCategory;
}

export interface UpdateBoardColumnRequest {
  name: string;
}

export interface ReorderBoardColumnsRequest {
  items: { id: string; sortOrder: number }[];
}

export const boardColumnsApi = {
  getAll: (projectId: string): Promise<BoardColumnDto[]> =>
    rawApiClient.get<BoardColumnDto[]>(BASE(projectId)),

  create: (projectId: string, payload: CreateBoardColumnRequest): Promise<BoardColumnDto> =>
    rawApiClient.post<BoardColumnDto>(BASE(projectId), payload),

  update: (projectId: string, id: string, payload: UpdateBoardColumnRequest): Promise<BoardColumnDto> =>
    rawApiClient.put<BoardColumnDto>(`${BASE(projectId)}/${id}`, payload),

  remove: (projectId: string, id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE(projectId)}/${id}`),

  reorder: (projectId: string, payload: ReorderBoardColumnsRequest): Promise<BoardColumnDto[]> =>
    rawApiClient.post<BoardColumnDto[]>(`${BASE(projectId)}/reorder`, payload),
};
