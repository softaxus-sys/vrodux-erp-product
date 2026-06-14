import { rawApiClient } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = (issueId: string) => `${API}/api/projectmanagement/issues/${issueId}/comments`;

export interface CommentDto {
  id: string;
  issueId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

export const commentsApi = {
  getAll: (issueId: string): Promise<CommentDto[]> =>
    rawApiClient.get<CommentDto[]>(BASE(issueId)),

  create: (issueId: string, body: string): Promise<CommentDto> =>
    rawApiClient.post<CommentDto>(BASE(issueId), { body }),

  update: (issueId: string, id: string, body: string): Promise<CommentDto> =>
    rawApiClient.put<CommentDto>(`${BASE(issueId)}/${id}`, { body }),

  remove: (issueId: string, id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE(issueId)}/${id}`),
};
