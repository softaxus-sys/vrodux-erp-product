import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  performanceApi,
  type CreateReviewRequest,
} from "@/lib/hr/performance.api";
import { toast } from "sonner";

export const performanceKeys = {
  all:    ["hr-performance"] as const,
  lists:  () => [...performanceKeys.all, "list"] as const,
  list:   (params?: object) => [...performanceKeys.lists(), params ?? {}] as const,
  detail: (id: string) => [...performanceKeys.all, "detail", id] as const,
};

export function usePerformanceReviews(params?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: performanceKeys.list(params),
    queryFn:  () => performanceApi.getAll(params),
  });
}

export function usePerformanceReview(id: string) {
  return useQuery({
    queryKey: performanceKeys.detail(id),
    queryFn:  () => performanceApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreatePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReviewRequest) => performanceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: performanceKeys.lists() });
      toast.success("Review created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => performanceApi.start(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: performanceKeys.lists() });
      qc.invalidateQueries({ queryKey: performanceKeys.detail(id) });
      toast.success("Review started.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
