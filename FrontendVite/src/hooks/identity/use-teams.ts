import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { teamsApi } from "@/lib/identity/teams.api";
import type { CreateTeamRequest, UpdateTeamRequest } from "@/lib/identity/teams.api";

const QK = "teams";

const t = (key: string, defaultValue: string) => i18n.t(`settings:${key}`, { defaultValue });

export function useTeams(search?: string) {
  return useQuery({
    queryKey: [QK, "list", search ?? ""],
    queryFn:  () => teamsApi.getAll(search),
    staleTime: 60 * 1000,
  });
}

export function useTeam(id: string | null) {
  return useQuery({
    queryKey: [QK, "detail", id],
    queryFn:  () => teamsApi.getById(id!),
    enabled:  !!id,
  });
}

/**
 * The pool the current user may assign work to. Resolved by the server from the caller's tier, so
 * an admin gets every active user and a team lead gets only their own members.
 */
export function useAssignableUsers(enabled = true, module?: string) {
  return useQuery({
    // The module is part of the key: "who can I assign a lead to" and "who can I assign a job to"
    // are different lists and must not share a cache entry.
    queryKey: [QK, "assignable-users", module ?? "all"],
    queryFn:  () => teamsApi.assignableUsers(module),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/** Eligible team leads — capability-based, see teamsApi.leadCandidates. */
export function useTeamLeadCandidates(enabled = true) {
  return useQuery({
    queryKey: [QK, "lead-candidates"],
    queryFn:  teamsApi.leadCandidates,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

function useTeamMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>, message: () => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success(message());
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateTeam() {
  return useTeamMutation(
    (body: CreateTeamRequest) => teamsApi.create(body),
    () => t("teams.created", "Team created."),
  );
}

export function useUpdateTeam() {
  return useTeamMutation(
    ({ id, ...body }: { id: string } & UpdateTeamRequest) => teamsApi.update(id, body),
    () => t("teams.updated", "Team updated."),
  );
}

export function useAddTeamMember() {
  return useTeamMutation(
    ({ teamId, userId }: { teamId: string; userId: string }) => teamsApi.addMember(teamId, userId),
    () => t("teams.memberAdded", "Member added."),
  );
}

export function useRemoveTeamMember() {
  return useTeamMutation(
    ({ teamId, userId }: { teamId: string; userId: string }) => teamsApi.removeMember(teamId, userId),
    () => t("teams.memberRemoved", "Member removed."),
  );
}

export function useDeleteTeam() {
  return useTeamMutation(
    (id: string) => teamsApi.remove(id),
    () => t("teams.deleted", "Team deleted."),
  );
}
