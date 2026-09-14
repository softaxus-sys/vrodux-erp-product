import { apiClient } from "@/lib/api-client";
import type {
  BoardColumnDto,
  CommentDto,
  CreateIssueRequest,
  GetIssuesParams,
  IssueDto,
  IssueSummaryDto,
  MoveIssueRequest,
  MoveIssueToSprintRequest,
  ProjectDto,
  ProjectMemberDto,
  ProjectSummaryDto,
  SprintDto,
  UpdateIssueRequest,
} from "@/types/project-management";

const BASE = "/api/projectmanagement";

/** No distinct `.labels.*`/`.comments.*` keys exist on the backend (confirmed by grep) --
 *  comments reuse `issues.create`/`issues.delete`; labels have no dedicated gate at all. */
export const PM_PROJECTS_VIEW = "project-management.projects.view";
export const PM_PROJECTS_CREATE = "project-management.projects.create";
export const PM_PROJECTS_EDIT = "project-management.projects.edit";
export const PM_PROJECTS_DELETE = "project-management.projects.delete";
export const PM_ISSUES_CREATE = "project-management.issues.create";
export const PM_ISSUES_EDIT = "project-management.issues.edit";
export const PM_ISSUES_DELETE = "project-management.issues.delete";
export const PM_SPRINTS_EDIT = "project-management.sprints.edit";

function buildIssuesQuery(p: GetIssuesParams): string {
  const qs = new URLSearchParams();
  qs.set("projectId", p.projectId);
  if (p.sprintId !== undefined) qs.set("sprintId", p.sprintId ?? "");
  if (p.boardColumnId) qs.set("boardColumnId", p.boardColumnId);
  if (p.type) qs.set("type", p.type);
  if (p.assigneeName) qs.set("assigneeName", p.assigneeName);
  if (p.search?.trim()) qs.set("search", p.search.trim());
  return qs.toString();
}

export const pmApi = {
  // ── Projects ─────────────────────────────────────────────────────────────
  // GET /projects is already scoped server-side to the caller's own project memberships unless
  // they're a super admin or hold projects.delete (the "admin bypass" -- ProjectAccessGuard.cs) --
  // no "my projects" vs "all projects" toggle is needed on the client.
  getProjects: (): Promise<ProjectSummaryDto[]> => apiClient.get(`${BASE}/projects`),

  getProject: (id: string): Promise<ProjectDto> => apiClient.get(`${BASE}/projects/${id}`),

  // ── Board columns ────────────────────────────────────────────────────────
  getBoardColumns: (projectId: string): Promise<BoardColumnDto[]> =>
    apiClient.get(`${BASE}/projects/${projectId}/columns`),

  // ── Issues ───────────────────────────────────────────────────────────────
  getIssues: (params: GetIssuesParams): Promise<IssueSummaryDto[]> =>
    apiClient.get(`${BASE}/issues?${buildIssuesQuery(params)}`),

  getIssue: (id: string): Promise<IssueDto> => apiClient.get(`${BASE}/issues/${id}`),

  createIssue: (payload: CreateIssueRequest): Promise<IssueDto> => apiClient.post(`${BASE}/issues`, payload),

  updateIssue: (id: string, payload: UpdateIssueRequest): Promise<IssueDto> =>
    apiClient.put(`${BASE}/issues/${id}`, payload),

  moveIssue: (id: string, payload: MoveIssueRequest): Promise<IssueDto> =>
    apiClient.post(`${BASE}/issues/${id}/move`, payload),

  moveIssueToSprint: (id: string, payload: MoveIssueToSprintRequest): Promise<IssueDto> =>
    apiClient.post(`${BASE}/issues/${id}/move-to-sprint`, payload),

  // ── Sprints ──────────────────────────────────────────────────────────────
  getSprints: (projectId: string): Promise<SprintDto[]> => apiClient.get(`${BASE}/projects/${projectId}/sprints`),

  startSprint: (projectId: string, id: string): Promise<SprintDto> =>
    apiClient.post(`${BASE}/projects/${projectId}/sprints/${id}/start`),

  completeSprint: (projectId: string, id: string): Promise<SprintDto> =>
    apiClient.post(`${BASE}/projects/${projectId}/sprints/${id}/complete`),

  // ── Comments ─────────────────────────────────────────────────────────────
  getComments: (issueId: string): Promise<CommentDto[]> => apiClient.get(`${BASE}/issues/${issueId}/comments`),

  addComment: (issueId: string, body: string): Promise<CommentDto> =>
    apiClient.post(`${BASE}/issues/${issueId}/comments`, { body }),

  // ── Project members (read-only on mobile for this pass) ────────────────
  getProjectMembers: (projectId: string): Promise<ProjectMemberDto[]> =>
    apiClient.get(`${BASE}/projects/${projectId}/members`),
};
