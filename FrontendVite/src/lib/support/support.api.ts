import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/support`;
export const SUPPORT_HUB_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/hubs/support`;

// ── Types ───────────────────────────────────────────────────────────────────

export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type TicketCategory = "billing" | "technical" | "feature_request" | "onboarding" | "account_security" | "general";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "billing",          label: "Billing" },
  { value: "technical",        label: "Technical Issue" },
  { value: "feature_request",  label: "Feature Request" },
  { value: "onboarding",       label: "Onboarding Help" },
  { value: "account_security", label: "Account & Security" },
  { value: "general",          label: "General" },
];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low",    label: "Low" },
  { value: "medium",  label: "Medium" },
  { value: "high",    label: "High" },
  { value: "urgent",  label: "Urgent" },
];

/** Styling only — labels come from TICKET_STATUS_LABELS below. */
export const TICKET_STATUS_META: Record<TicketStatus, { color: string; bg: string; label: string }> = {
  open:                 { color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",     label: "Open" },
  in_progress:          { color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",   label: "In Progress" },
  waiting_on_customer:  { color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20", label: "Waiting on You" },
  resolved:             { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", label: "Resolved" },
  closed:               { color: "text-muted-foreground", bg: "bg-muted", label: "Closed" },
};

export const TICKET_PRIORITY_META: Record<TicketPriority, { color: string; bg: string }> = {
  low:    { color: "text-muted-foreground", bg: "bg-muted" },
  medium: { color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  high:   { color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  urgent: { color: "text-destructive", bg: "bg-destructive/10" },
};

/** Mirrors SupportTicket.Transitions on the backend — the agent UI only offers legal moves. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:                ["in_progress", "resolved", "closed"],
  in_progress:         ["waiting_on_customer", "resolved", "closed"],
  waiting_on_customer: ["in_progress", "resolved", "closed"],
  resolved:            ["closed", "in_progress"],
  closed:              ["in_progress"],
};

export interface TicketAttachmentDto {
  id: string; fileName: string; contentType: string; dataUri: string; sizeBytes: number;
  uploadedByName: string; createdAt: string;
}

export interface AttachmentInput { fileName: string; contentType: string; dataUri: string; }

export const ATTACHMENT_MAX_FILES = 3;
export const ATTACHMENT_MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB — mirrors TicketAttachmentLimits on the backend
export const ATTACHMENT_ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "text/csv",
];

export interface TicketMessageDto {
  id: string; authorUserId: string; authorName: string; isFromAgent: boolean;
  body: string; createdAt: string; attachments: TicketAttachmentDto[];
}

export interface TicketAssignmentDto {
  id: string; fromUserId?: string | null; fromUserName?: string | null;
  toUserId?: string | null; toUserName?: string | null;
  changedByName: string; note?: string | null; createdAt: string;
}

export interface TicketSummaryDto {
  id: string; ticketNumber: string;
  requestingTenantId: string; requestingTenantName: string;
  requestingUserId: string; requestingUserName: string;
  subject: string; category: TicketCategory; priority: TicketPriority; status: TicketStatus;
  assignedToUserId?: string | null; assignedToUserName?: string | null;
  messageCount: number; createdAt: string; updatedAt?: string | null; closedAt?: string | null;
}

export interface TicketDetailDto {
  id: string; ticketNumber: string;
  requestingTenantId: string; requestingTenantName: string;
  requestingUserId: string; requestingUserName: string; requestingUserEmail: string;
  subject: string; category: TicketCategory; priority: TicketPriority; status: TicketStatus;
  assignedToUserId?: string | null; assignedToUserName?: string | null;
  messages: TicketMessageDto[];
  assignmentHistory: TicketAssignmentDto[];
  createdAt: string; updatedAt?: string | null; closedAt?: string | null;
}

export interface SupportQueueSummaryDto {
  total: number; open: number; inProgress: number; waitingOnCustomer: number;
  unassigned: number; myOpen: number;
}

export interface SupportAgentDto { id: string; name: string; email: string; }

export interface CreateTicketRequest {
  subject: string; category: TicketCategory; priority: TicketPriority; message: string;
  attachments?: AttachmentInput[];
}

// ── API ─────────────────────────────────────────────────────────────────────

export const supportApi = {
  // Any authenticated user, any tenant.
  createTicket: (body: CreateTicketRequest): Promise<TicketDetailDto> =>
    rawApiClient.post(`${BASE}/tickets`, body),
  getMyTickets: (status?: TicketStatus): Promise<TicketSummaryDto[]> =>
    rawApiClient.get(`${BASE}/my-tickets${status ? `?status=${status}` : ""}`),
  getTicket: (id: string): Promise<TicketDetailDto> =>
    rawApiClient.get(`${BASE}/tickets/${id}`),
  addMessage: (id: string, body: string, attachments?: AttachmentInput[]): Promise<TicketMessageDto> =>
    rawApiClient.post(`${BASE}/tickets/${id}/messages`, { body, attachments }),

  // Softaxis support agents only (operator tenant + permission — enforced server-side).
  getQueue: (params?: { status?: TicketStatus; category?: TicketCategory; assignedToUserId?: string }): Promise<TicketSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.category) qs.set("category", params.category);
    if (params?.assignedToUserId) qs.set("assignedToUserId", params.assignedToUserId);
    const q = qs.toString();
    return rawApiClient.get(`${BASE}/queue${q ? `?${q}` : ""}`);
  },
  getQueueSummary: (): Promise<SupportQueueSummaryDto> => rawApiClient.get(`${BASE}/queue/summary`),
  getAgents: (): Promise<SupportAgentDto[]> => rawApiClient.get(`${BASE}/agents`),
  changeStatus: (id: string, status: TicketStatus): Promise<void> =>
    rawApiClient.patch(`${BASE}/tickets/${id}/status`, { status }),
  assign: (id: string, assignToUserId: string | null, assignToUserName: string | null, note?: string): Promise<void> =>
    rawApiClient.patch(`${BASE}/tickets/${id}/assign`, { assignToUserId, assignToUserName, note }),
  setPriority: (id: string, priority: TicketPriority): Promise<void> =>
    rawApiClient.patch(`${BASE}/tickets/${id}/priority`, { priority }),
};
