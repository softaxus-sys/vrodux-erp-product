import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApi, type CommentDto } from "@/lib/project-management/comments.api";
import { issueKeys } from "@/hooks/project-management/use-issues";
import { toast } from "sonner";

export const commentKeys = {
  all:  ["pm-comments"] as const,
  list: (issueId: string) => [...commentKeys.all, issueId] as const,
};

export function useComments(issueId: string | null) {
  return useQuery<CommentDto[]>({
    queryKey: commentKeys.list(issueId ?? ""),
    queryFn:  () => commentsApi.getAll(issueId!),
    enabled:  !!issueId,
  });
}

export function useCreateComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => commentsApi.create(issueId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.list(issueId) });
      qc.invalidateQueries({ queryKey: issueKeys.detail(issueId) });
      toast.success("Comment added.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => commentsApi.update(issueId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.list(issueId) });
      toast.success("Comment updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.remove(issueId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.list(issueId) });
      qc.invalidateQueries({ queryKey: issueKeys.detail(issueId) });
      toast.success("Comment deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
