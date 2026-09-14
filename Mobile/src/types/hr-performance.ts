/** Authenticated performance review management (`/api/hr/performance/*`). Real pagination used
 *  on mobile, same reasoning as hr-recruitment.ts (web over-fetches with pageSize=500). */
export type ReviewType = "annual" | "mid_year" | "probation" | "pip";
export type ReviewStatus = "pending" | "in_progress" | "completed" | "overdue";
export type Rating = 1 | 2 | 3 | 4 | 5;
export type GoalStatus = "on_track" | "at_risk" | "achieved" | "missed";

export interface PerformanceGoalDto {
  id: string;
  title: string;
  target: string;
  progress: number;
  status: GoalStatus;
  dueDate: string;
}

export interface PerformanceReviewDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string | null;
  designation?: string | null;
  reviewPeriod: string;
  reviewType: ReviewType;
  status: ReviewStatus;
  overallRating?: Rating | null;
  technicalRating?: Rating | null;
  communicationRating?: Rating | null;
  teamworkRating?: Rating | null;
  leadershipRating?: Rating | null;
  reviewedBy: string;
  dueDate: string;
  completedDate?: string | null;
  strengths?: string | null;
  improvements?: string | null;
  goals: PerformanceGoalDto[];
}

export interface ReviewsPageParams {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
  employeeId?: string;
}

export interface PerformanceSummaryDto {
  totalReviews: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  avgRating: number;
}

export interface CompleteReviewPayload {
  overallRating?: Rating;
  technicalRating?: Rating;
  communicationRating?: Rating;
  teamworkRating?: Rating;
  leadershipRating?: Rating;
  strengths?: string;
  improvements?: string;
}

export interface UpdateGoalPayload {
  progress: number;
  status: GoalStatus;
}

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  annual: "Annual",
  mid_year: "Mid-year",
  probation: "Probation",
  pip: "PIP",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

export const REVIEW_STATUS_TONE: Record<ReviewStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  pending: "neutral",
  in_progress: "info",
  completed: "success",
  overdue: "destructive",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  achieved: "Achieved",
  missed: "Missed",
};

export const GOAL_STATUS_TONE: Record<GoalStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  on_track: "info",
  at_risk: "warning",
  achieved: "success",
  missed: "destructive",
};
