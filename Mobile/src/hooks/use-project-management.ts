import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pmApi } from "@/lib/project-management.api";
import type { CreateIssueRequest, GetIssuesParams, MoveIssueRequest, MoveIssueToSprintRequest, UpdateIssueRequest } from "@/types/project-management";

const QK = "pm" as const;

export function useProjects() {
  return useQuery({
    queryKey: [QK, "projects"],
    queryFn: pmApi.getProjects,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [QK, "project", id],
    queryFn: () => pmApi.getProject(id),
    enabled: Boolean(id),
  });
}

export function useBoardColumns(projectId: string) {
  return useQuery({
    queryKey: [QK, "columns", projectId],
    queryFn: () => pmApi.getBoardColumns(projectId),
    enabled: Boolean(projectId),
  });
}

export function useIssues(params: GetIssuesParams) {
  return useQuery({
    queryKey: [QK, "issues", params],
    queryFn: () => pmApi.getIssues(params),
    enabled: Boolean(params.projectId),
  });
}

export function useIssue(id: string) {
  return useQuery({
    queryKey: [QK, "issue", id],
    queryFn: () => pmApi.getIssue(id),
    enabled: Boolean(id),
  });
}

function invalidateIssueLists(qc: ReturnType<typeof useQueryClient>, projectId?: string) {
  qc.invalidateQueries({ queryKey: [QK, "issues"] });
  if (projectId) qc.invalidateQueries({ queryKey: [QK, "project", projectId] });
  qc.invalidateQueries({ queryKey: [QK, "projects"] });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIssueRequest) => pmApi.createIssue(payload),
    onSuccess: (issue) => invalidateIssueLists(qc, issue.projectId),
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIssueRequest }) => pmApi.updateIssue(id, payload),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: [QK, "issue", issue.id] });
      invalidateIssueLists(qc, issue.projectId);
    },
  });
}

export function useMoveIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MoveIssueRequest }) => pmApi.moveIssue(id, payload),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: [QK, "issue", issue.id] });
      invalidateIssueLists(qc, issue.projectId);
    },
  });
}

export function useMoveIssueToSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MoveIssueToSprintRequest }) => pmApi.moveIssueToSprint(id, payload),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: [QK, "issue", issue.id] });
      invalidateIssueLists(qc, issue.projectId);
    },
  });
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: [QK, "sprints", projectId],
    queryFn: () => pmApi.getSprints(projectId),
    enabled: Boolean(projectId),
  });
}

function useSprintAction(fn: (projectId: string, id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => fn(projectId, id),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: [QK, "sprints", projectId] }),
  });
}

export function useStartSprint() {
  return useSprintAction(pmApi.startSprint);
}

export function useCompleteSprint() {
  return useSprintAction(pmApi.completeSprint);
}

export function useComments(issueId: string) {
  return useQuery({
    queryKey: [QK, "comments", issueId],
    queryFn: () => pmApi.getComments(issueId),
    enabled: Boolean(issueId),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) => pmApi.addComment(issueId, body),
    onSuccess: (_data, { issueId }) => {
      qc.invalidateQueries({ queryKey: [QK, "comments", issueId] });
      qc.invalidateQueries({ queryKey: [QK, "issue", issueId] });
    },
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: [QK, "members", projectId],
    queryFn: () => pmApi.getProjectMembers(projectId),
    enabled: Boolean(projectId),
  });
}
