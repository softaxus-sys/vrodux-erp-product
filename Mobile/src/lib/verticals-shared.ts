import type { Tone } from "@/theme";

/**
 * Shared across the six industry-vertical modules (B2B, Education, Healthcare, Insurance,
 * Construction, Hospitality) -- all read-only browse-and-search here (see the per-module README
 * notes for why creation/status-editing is deferred). Since nothing writes a status, there's no
 * need to hand-enumerate each entity's exact status vocabulary the way Visa's CASE_STATUS_TONE or
 * Restaurant's ORDER_STATUS_TONE do for their write-capable screens -- a badge is read-only
 * decoration here, so a keyword heuristic over whatever string the backend returns is honest and
 * good enough, and it never goes stale when a tenant-specific status value shows up that a
 * hand-built enum wouldn't have listed.
 */
export function titleCaseStatus(status: string): string {
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SUCCESS_WORDS = ["complete", "completed", "resolved", "approved", "active", "paid", "won", "checked"];
const DESTRUCTIVE_WORDS = ["cancel", "rejected", "reject", "expired", "declined", "lapsed", "critical", "overdue"];
const WARNING_WORDS = ["pending", "open", "draft", "due", "in_progress", "in progress", "scheduled", "review"];

export function guessStatusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (SUCCESS_WORDS.some((w) => s.includes(w))) return "success";
  if (DESTRUCTIVE_WORDS.some((w) => s.includes(w))) return "destructive";
  if (WARNING_WORDS.some((w) => s.includes(w))) return "warning";
  return "neutral";
}

/** Paging shape shared by every B2B/Education/Healthcare/Insurance list endpoint. Mirrors
 *  FrontendVite's VerticalPage<T> -- narrower than api-client.ts's PagedResult<T> (no
 *  hasNext/hasPrev), which is fine since every list screen derives "more pages?" from
 *  page < totalPages anyway, same as the Sales/Real Estate infinite-scroll screens do. */
export interface VerticalPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface VerticalPageParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}
