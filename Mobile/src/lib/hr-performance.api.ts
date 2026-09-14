import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  CompleteReviewPayload,
  PerformanceReviewDto,
  PerformanceSummaryDto,
  ReviewsPageParams,
  UpdateGoalPayload,
} from "@/types/hr-performance";

const BASE = "/api/hr/performance";

export const HR_PERFORMANCE_VIEW = "hr.performance.view";
export const HR_PERFORMANCE_CREATE = "hr.performance.create";
/** No seeded `.delete` permission exists for this module (confirmed against
 *  PerformanceController.cs's own comment) -- delete and every goal action ride on `.edit`. */
export const HR_PERFORMANCE_EDIT = "hr.performance.edit";

function buildReviewsQuery(p: ReviewsPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 20));
  if (p.status) qs.set("status", p.status);
  if (p.employeeId) qs.set("employeeId", p.employeeId);
  return qs.toString();
}

export const hrPerformanceApi = {
  getReviews: (params: ReviewsPageParams = {}): Promise<PagedResult<PerformanceReviewDto>> =>
    apiClient.get(`${BASE}?${buildReviewsQuery(params)}`),

  getReview: (id: string): Promise<PerformanceReviewDto> => apiClient.get(`${BASE}/${id}`),

  getSummary: (): Promise<PerformanceSummaryDto> => apiClient.get(`${BASE}/summary`),

  startReview: (id: string): Promise<void> => apiClient.post(`${BASE}/${id}/start`, {}),

  completeReview: (id: string, payload: CompleteReviewPayload): Promise<PerformanceReviewDto> =>
    apiClient.post(`${BASE}/${id}/complete`, payload),

  updateGoal: (reviewId: string, goalId: string, payload: UpdateGoalPayload): Promise<void> =>
    apiClient.put(`${BASE}/${reviewId}/goals/${goalId}`, payload),
};
