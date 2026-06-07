import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/crm`;

export type DealStage    = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type DealPriority = "low" | "medium" | "high";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task";

export const PIPELINE_STAGES: { key: DealStage; label: string; color: string; bg: string }[] = [
  { key: "lead",        label: "Lead",        color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  { key: "qualified",   label: "Qualified",   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  { key: "proposal",    label: "Proposal",    color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  { key: "negotiation", label: "Negotiation", color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  { key: "won",         label: "Won",         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { key: "lost",        label: "Lost",        color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20" },
];

export interface DealActivityDto {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface DealContactDto {
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface DealDto {
  id: string;
  title: string;
  company: string;
  value: number;
  currency: "AED" | "USD" | "SAR";
  stage: DealStage;
  priority: DealPriority;
  probability: number;
  expectedCloseDate: string;
  createdDate: string;
  assignedTo: string;
  contact: DealContactDto;
  source: string;
  industry: string;
  description: string;
  tags: string[];
  activities: DealActivityDto[];
  nextAction?: string;
  nextActionDate?: string;
}

export interface DealSummaryDto {
  totalDeals: number;
  totalValue: number;
  wonValue: number;
  lostDeals: number;
  avgDealSize: number;
  winRate: number;
}

export interface CreateDealRequest {
  title: string;
  company: string;
  value: number;
  currency: "AED" | "USD" | "SAR";
  stage: DealStage;
  priority: DealPriority;
  probability: number;
  expectedCloseDate: string;
  assignedTo: string;
  source: string;
  industry: string;
  description: string;
  tags?: string[];
  contact: DealContactDto;
}

export const dealsApi = {
  getAll: (params?: Record<string, string>): Promise<DealDto[]> => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return rawApiClient.get<DealDto[]>(`${BASE}/deals${qs}`);
  },

  getById: (id: string): Promise<DealDto> =>
    rawApiClient.get<DealDto>(`${BASE}/deals/${id}`),

  create: (data: CreateDealRequest): Promise<DealDto> =>
    rawApiClient.post<DealDto>(`${BASE}/deals`, data),

  updateStage: (id: string, stage: DealStage): Promise<DealDto> =>
    rawApiClient.put<DealDto>(`${BASE}/deals/${id}/stage`, { stage }),

  getSummary: (): Promise<DealSummaryDto> =>
    rawApiClient.get<DealSummaryDto>(`${BASE}/deals/summary`),
};
