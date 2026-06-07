import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/crm`;

export type LeadStatus   = "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost";
export type LeadSource   =
  | "website" | "linkedin" | "referral" | "cold_call" | "trade_show"
  | "google_ads" | "email_campaign" | "partner" | "social_media" | "walk_in";
export type LeadPriority = "low" | "medium" | "high";

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website:        "Website",
  linkedin:       "LinkedIn",
  referral:       "Referral",
  cold_call:      "Cold Call",
  trade_show:     "Trade Show",
  google_ads:     "Google Ads",
  email_campaign: "Email Campaign",
  partner:        "Partner",
  social_media:   "Social Media",
  walk_in:        "Walk-in",
};

export interface LeadActivityDto {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "task";
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface LeadDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  score: number;
  estimatedValue: number;
  currency: "AED" | "USD" | "SAR";
  assignedTo: string;
  createdDate: string;
  lastContactDate?: string;
  nextFollowUp?: string;
  notes?: string;
  tags: string[];
  activities: LeadActivityDto[];
  convertedDealId?: string;
}

export interface LeadSummaryDto {
  total: number;
  newThisWeek: number;
  qualified: number;
  contacted: number;
  converted: number;
  conversionRate: number;
  totalEstimatedValue: number;
}

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  source: LeadSource;
  priority: LeadPriority;
  estimatedValue: number;
  currency: "AED" | "USD" | "SAR";
  assignedTo: string;
  notes?: string;
  tags?: string[];
}

export const leadsApi = {
  getAll: (params?: Record<string, string>): Promise<LeadDto[]> => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return rawApiClient.get<LeadDto[]>(`${BASE}/leads${qs}`);
  },

  getById: (id: string): Promise<LeadDto> =>
    rawApiClient.get<LeadDto>(`${BASE}/leads/${id}`),

  create: (data: CreateLeadRequest): Promise<LeadDto> =>
    rawApiClient.post<LeadDto>(`${BASE}/leads`, data),

  updateStatus: (id: string, status: LeadStatus): Promise<LeadDto> =>
    rawApiClient.put<LeadDto>(`${BASE}/leads/${id}/status`, { status }),

  getSummary: (): Promise<LeadSummaryDto> =>
    rawApiClient.get<LeadSummaryDto>(`${BASE}/leads/summary`),
};
