/**
 * Mirrors FrontendVite/src/lib/project-management/*.api.ts's DTOs exactly. Web splits this into
 * 4 routes sharing a pill-tab strip (Board/Backlog/Issues, all project-scoped) plus a project
 * list page -- mobile mirrors that as a project home screen with MenuCard entries instead (the
 * pattern every other module's "home" screen already uses), not a tab strip in the header.
 */
export type ProjectStatus = "active" | "archived";

/** `GET /projects` (list) shape -- already carries the dashboard-card stats, no separate summary
 *  endpoint exists. */
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

/** `GET /projects/{id}` shape -- no stats, has nextIssueNumber instead. */
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

export type BoardColumnCategory = "backlog" | "todo" | "in_progress" | "done";

export interface BoardColumnDto {
  id: string;
  projectId: string;
  name: string;
  category: BoardColumnCategory;
  sortOrder: number;
  isDefault: boolean;
}

export type IssueType = "epic" | "story" | "task" | "bug";
export type IssuePriority = "lowest" | "low" | "medium" | "high" | "highest";

export interface IssueLabelDto {
  id: string;
  name: string;
  color: string;
}

/** `GET /issues` (list) shape. */
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

/** `GET /issues/{id}` shape -- everything from the summary plus these. */
export interface IssueDto extends IssueSummaryDto {
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

/** No boardColumnId/sprintId here -- those change only via move()/moveToSprint(). */
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

/** sortOrder is the destination list's 0-based index, not a global sort value -- there is no
 *  separate "reorder within the same column" endpoint, a move within one column is just this
 *  same call with the same boardColumnId and a new sortOrder. */
export interface MoveIssueRequest {
  boardColumnId: string;
  sortOrder: number;
}

export interface MoveIssueToSprintRequest {
  sprintId?: string | null;
  sortOrder: number;
}

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

export interface CommentDto {
  id: string;
  issueId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

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

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  epic: "Epic",
  story: "Story",
  task: "Task",
  bug: "Bug",
};

export const ISSUE_TYPE_ICON: Record<IssueType, string> = {
  epic: "zap",
  story: "bookmark",
  task: "check-square",
  bug: "alert-circle",
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  lowest: "Lowest",
  low: "Low",
  medium: "Medium",
  high: "High",
  highest: "Highest",
};

export const ISSUE_PRIORITY_TONE: Record<IssuePriority, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  lowest: "neutral",
  low: "info",
  medium: "warning",
  high: "destructive",
  highest: "destructive",
};

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export const SPRINT_STATUS_TONE: Record<SprintStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  planned: "neutral",
  active: "success",
  completed: "info",
};
