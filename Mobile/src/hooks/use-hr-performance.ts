import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hrPerformanceApi } from "@/lib/hr-performance.api";
import type { CompleteReviewPayload, ReviewsPageParams, UpdateGoalPayload } from "@/types/hr-performance";

const QK = "hr-performance" as const;

export function useReviews(params: ReviewsPageParams) {
  return useQuery({
    queryKey: [QK, "reviews", params],
    queryFn: () => hrPerformanceApi.getReviews(params),
  });
}

export function useReview(id: string) {
  return useQuery({
    queryKey: [QK, "review", id],
    queryFn: () => hrPerformanceApi.getReview(id),
    enabled: Boolean(id),
  });
}

export function usePerformanceSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn: hrPerformanceApi.getSummary,
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrPerformanceApi.startReview(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [QK, "reviews"] });
      qc.invalidateQueries({ queryKey: [QK, "review", id] });
    },
  });
}

export function useCompleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CompleteReviewPayload }) => hrPerformanceApi.completeReview(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [QK, "reviews"] });
      qc.invalidateQueries({ queryKey: [QK, "review", id] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, goalId, payload }: { reviewId: string; goalId: string; payload: UpdateGoalPayload }) =>
      hrPerformanceApi.updateGoal(reviewId, goalId, payload),
    onSuccess: (_data, { reviewId }) => qc.invalidateQueries({ queryKey: [QK, "review", reviewId] }),
  });
}
