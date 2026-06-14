import { rawApiClient } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API}/api/projectmanagement/issues`;

export type IssueType = "epic" | "story" | "task" | "bug";
export type IssuePriority = "lowest" | "low" | "medium" | "high" | "highest";

export const ISSUE_TYPES: IssueType[] = ["epic", "story", "task", "bug"];
export const ISSUE_PRIORITIES: IssuePriority[] = ["lowest", "low", "medium", "high", "highest"];

export interface IssueLabelDto {
  id: string;
  name: string;
  color: string;
}

export interface IssueSummaryDto {
  id: string;
  projectId: string;
  issueKey: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  boardColumnId: string;
  boardColumnName: string;
  boardColumnCategory: string;
  assigneeId: string | null;
  assigneeName: string | null;
  reporterName: string;
  epicId: string | null;
  epicKey: string | null;
  epicTitle: string | null;
  sprintId: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  sortOrder: number;
  resolvedAt: string | null;
  labels: IssueLabelDto[];
}

export interface IssueDto extends Omit<IssueSummaryDto, never> {
  description: string | null;
  sprintName: string | null;
  createdAt: string;
  updatedAt: string | null;
  commentCount: number;
}

export interface GetIssuesParams {
  projectId: string;
  sprintId?: string | null;
  boardColumnId?: string;
  type?: string;
  assigneeName?: string;
  search?: string;
}

export interface CreateIssueRequest {
  projectId: string;
  title: string;
  description?: string | null;
  type?: IssueType;
  priority?: IssuePriority;
  boardColumnId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  labelIds?: string[];
}

export interface UpdateIssueRequest {
  title: string;
  description?: string | null;
  type: IssueType;
  priority: IssuePriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  epicId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  labelIds?: string[];
}

export interface MoveIssueRequest {
  boardColumnId: string;
  sortOrder: number;
}

export interface MoveIssueToSprintRequest {
  sprintId?: string | null;
  sortOrder: number;
}

export const issuesApi = {
  getAll: (params: GetIssuesParams): Promise<IssueSummaryDto[]> => {
    const qs = new URLSearchParams();
    qs.set("projectId", params.projectId);
    if (params.sprintId) qs.set("sprintId", params.sprintId);
    if (params.boardColumnId) qs.set("boardColumnId", params.boardColumnId);
    if (params.type) qs.set("type", params.type);
    if (params.assigneeName) qs.set("assigneeName", params.assigneeName);
    if (params.search) qs.set("search", params.search);
    return rawApiClient.get<IssueSummaryDto[]>(`${BASE}?${qs.toString()}`);
  },

  getById: (id: string): Promise<IssueDto> =>
    rawApiClient.get<IssueDto>(`${BASE}/${id}`),

  create: (payload: CreateIssueRequest): Promise<IssueDto> =>
    rawApiClient.post<IssueDto>(BASE, payload),

  update: (id: string, payload: UpdateIssueRequest): Promise<IssueDto> =>
    rawApiClient.put<IssueDto>(`${BASE}/${id}`, payload),

  move: (id: string, payload: MoveIssueRequest): Promise<IssueDto> =>
    rawApiClient.post<IssueDto>(`${BASE}/${id}/move`, payload),

  moveToSprint: (id: string, payload: MoveIssueToSprintRequest): Promise<IssueDto> =>
    rawApiClient.post<IssueDto>(`${BASE}/${id}/move-to-sprint`, payload),

  remove: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
