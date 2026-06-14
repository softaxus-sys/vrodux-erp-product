import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  issuesApi,
  type IssueDto,
  type IssueSummaryDto,
  type GetIssuesParams,
  type CreateIssueRequest,
  type UpdateIssueRequest,
  type MoveIssueRequest,
  type MoveIssueToSprintRequest,
} from "@/lib/project-management/issues.api";
import { projectKeys } from "@/hooks/project-management/use-projects";
import { sprintKeys } from "@/hooks/project-management/use-sprints";
import { toast } from "sonner";

export const issueKeys = {
  all:     ["pm-issues"] as const,
  lists:   () => [...issueKeys.all, "list"] as const,
  list:    (params: GetIssuesParams) => [...issueKeys.lists(), params] as const,
  details: () => [...issueKeys.all, "detail"] as const,
  detail:  (id: string) => [...issueKeys.details(), id] as const,
};

export function useIssues(params: GetIssuesParams | null) {
  return useQuery<IssueSummaryDto[]>({
    queryKey: issueKeys.list(params ?? { projectId: "" }),
    queryFn:  () => issuesApi.getAll(params!),
    enabled:  !!params?.projectId,
  });
}

export function useIssue(id: string | null) {
  return useQuery<IssueDto>({
    queryKey: issueKeys.detail(id ?? ""),
    queryFn:  () => issuesApi.getById(id!),
    enabled:  !!id,
  });
}

function invalidateIssueLists(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: issueKeys.lists() });
  qc.invalidateQueries({ queryKey: projectKeys.lists() });
  qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIssueRequest) => issuesApi.create(payload),
    onSuccess: (data) => {
      invalidateIssueLists(qc, data.projectId);
      toast.success(`${data.issueKey} created.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIssueRequest }) =>
      issuesApi.update(id, payload),
    onSuccess: (data) => {
      invalidateIssueLists(qc, data.projectId);
      qc.invalidateQueries({ queryKey: issueKeys.detail(data.id) });
      toast.success("Issue updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMoveIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MoveIssueRequest }) =>
      issuesApi.move(id, payload),
    onSuccess: (data) => {
      invalidateIssueLists(qc, data.projectId);
      qc.invalidateQueries({ queryKey: issueKeys.detail(data.id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMoveIssueToSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MoveIssueToSprintRequest }) =>
      issuesApi.moveToSprint(id, payload),
    onSuccess: (data) => {
      invalidateIssueLists(qc, data.projectId);
      qc.invalidateQueries({ queryKey: issueKeys.detail(data.id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => issuesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: issueKeys.lists() });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Issue deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
