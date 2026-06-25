import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  projectMembersApi,
  type ProjectMemberDto,
  type ProjectMemberRole,
  type AddProjectMemberRequest,
} from "@/lib/project-management/project-members.api";
import { projectKeys } from "./use-projects";
import { toast } from "sonner";

export const projectMemberKeys = {
  all:  ["pm-project-members"] as const,
  list: (projectId: string) => [...projectMemberKeys.all, projectId] as const,
};

export function useProjectMembers(projectId: string | null) {
  return useQuery<ProjectMemberDto[]>({
    queryKey: projectMemberKeys.list(projectId ?? ""),
    queryFn:  () => projectMembersApi.getAll(projectId!),
    enabled:  !!projectId,
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddProjectMemberRequest) => projectMembersApi.add(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMemberKeys.list(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Member added.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectMemberRole }) =>
      projectMembersApi.updateRole(projectId, memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMemberKeys.list(projectId) });
      toast.success("Member role updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => projectMembersApi.remove(projectId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMemberKeys.list(projectId) });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Member removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
