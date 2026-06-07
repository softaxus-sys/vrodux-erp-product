import { rawApiClient } from "@/lib/api-client";
import type { PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/performance-reviews`;

export interface GoalDto {
  id: string;
  title: string;
  target: string | null;
  progress: number;
  status: string;
  dueDate: string | null;
}

export interface PerformanceReviewSummaryDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  reviewPeriod: string;
  reviewType: string;
  dueDate: string;
  reviewedBy: string | null;
  status: string;
  overallRating: number | null;
  goalCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface PerformanceReviewDto extends Omit<PerformanceReviewSummaryDto, "goalCount"> {
  technicalRating: number | null;
  communicationRating: number | null;
  teamworkRating: number | null;
  leadershipRating: number | null;
  strengths: string | null;
  improvements: string | null;
  goals: GoalDto[];
}

export interface CreateReviewRequest {
  employeeId: string;
  reviewPeriod: string;
  reviewType: string;
  dueDate: string;
  reviewedBy?: string | null;
}

export const performanceApi = {
  getAll: (params?: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<PerformanceReviewSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params?.status)   qs.set("status",   params.status);
    if (params?.search)   qs.set("search",   params.search);
    if (params?.page)     qs.set("page",     String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const q = qs.toString();
    return rawApiClient.get<PagedResult<PerformanceReviewSummaryDto>>(q ? `${BASE}?${q}` : BASE);
  },

  getById: (id: string): Promise<PerformanceReviewDto> =>
    rawApiClient.get<PerformanceReviewDto>(`${BASE}/${id}`),

  create: (data: CreateReviewRequest): Promise<PerformanceReviewDto> =>
    rawApiClient.post<PerformanceReviewDto>(BASE, data),

  start: (id: string): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}/start`, {}),

  complete: (id: string, ratings: {
    overallRating?: number | null;
    technicalRating?: number | null;
    communicationRating?: number | null;
    teamworkRating?: number | null;
    leadershipRating?: number | null;
    strengths?: string | null;
    improvements?: string | null;
  }): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}/complete`, ratings),
};
