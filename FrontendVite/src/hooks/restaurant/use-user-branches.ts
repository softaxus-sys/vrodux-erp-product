import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userBranchesApi, type AddUserBranchRequest, type BranchRole } from "@/lib/restaurant/user-branches.api";

export const userBranchKeys = {
  all:   ["restaurant-user-branches"] as const,
  mine:  () => [...userBranchKeys.all, "mine"] as const,
  admin: (userId?: string) => [...userBranchKeys.all, "admin", userId ?? "all"] as const,
};

export const useMyBranches = () =>
  useQuery({ queryKey: userBranchKeys.mine(), queryFn: userBranchesApi.mine });

export const useUserBranches = (userId?: string) =>
  useQuery({ queryKey: userBranchKeys.admin(userId), queryFn: () => userBranchesApi.getAll(userId) });

function useInvalidateUserBranches() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: userBranchKeys.all });
}

export function useAddUserBranch() {
  const invalidate = useInvalidateUserBranches();
  return useMutation({
    mutationFn: (req: AddUserBranchRequest) => userBranchesApi.add(req),
    onSuccess: () => { invalidate(); toast.success("Branch access granted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateUserBranchRole() {
  const invalidate = useInvalidateUserBranches();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: BranchRole }) => userBranchesApi.updateRole(id, role),
    onSuccess: () => { invalidate(); toast.success("Role updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveUserBranch() {
  const invalidate = useInvalidateUserBranches();
  return useMutation({
    mutationFn: (id: string) => userBranchesApi.remove(id),
    onSuccess: () => { invalidate(); toast.success("Branch access removed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
