import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { localToday } from "./library.api";

const BASE = `${getApiBaseUrl()}/api/library`;

// ── Staff side ──────────────────────────────────────────────────────────────

export interface PortalSettingsDto {
  enabled: boolean; allowRenewals: boolean; allowReservations: boolean; publicCatalogue: boolean;
  membersWithAccess: number;
}
export type PortalSettingsRequest = Omit<PortalSettingsDto, "membersWithAccess">;

/** The PIN is in this response once and cannot be read again. */
export interface MemberPortalPinDto { memberNumber: string; pin: string }

export const portalAdminApi = {
  getSettings:    (): Promise<PortalSettingsDto> => rawApiClient.get(`${BASE}/portal-settings`),
  updateSettings: (body: PortalSettingsRequest): Promise<PortalSettingsDto> => rawApiClient.put(`${BASE}/portal-settings`, body),
  setPin:         (memberId: string): Promise<MemberPortalPinDto> => rawApiClient.post(`${BASE}/members/${memberId}/portal-pin`, {}),
  clearPin:       (memberId: string): Promise<void> => rawApiClient.delete(`${BASE}/members/${memberId}/portal-pin`),
};

/** The address members open. Hash-routed desktop builds have no shareable address. */
export const portalUrl = (slug: string) => `${window.location.origin}/library-portal/${slug}`;

// ── Member side ─────────────────────────────────────────────────────────────

export interface PortalBranchDto { id: string; name: string }
export interface PortalInfoDto {
  libraryName: string; allowRenewals: boolean; allowReservations: boolean; publicCatalogue: boolean;
  currency: string | null; branches: PortalBranchDto[];
}
export interface PortalSessionDto { token: string; expiresAt: string; memberName: string; memberNumber: string }
export interface PortalMemberDto {
  memberNumber: string; fullName: string; membershipType: string; expiresOn: string | null; isExpired: boolean;
  status: string; maxLoans: number; maxRenewals: number; maxReservations: number; homeBranchName: string | null;
}
export interface PortalLoanDto {
  id: string; title: string; authors: string; barcode: string; branchName: string; issuedOn: string; dueDate: string;
  renewalCount: number; isOverdue: boolean; daysOverdue: number;
}
export interface PortalReservationDto {
  id: string; titleId: string; title: string; pickupBranchName: string; status: string; reservedOn: string;
  holdUntil: string | null; holdExpired: boolean;
}
export interface PortalFineDto { id: string; type: string; title: string | null; reason: string | null; balance: number; createdOn: string }
export interface PortalAccountDto {
  member: PortalMemberDto; loans: PortalLoanDto[]; reservations: PortalReservationDto[]; fines: PortalFineDto[];
  finesTotal: number;
}
export interface PortalBranchStockDto { branchId: string; branchName: string; copies: number; available: number }
export interface PortalTitleDto {
  id: string; title: string; subtitle: string | null; authors: string; category: string | null; materialType: string;
  publisher: string | null; publicationYear: number | null; language: string | null; description: string | null;
  copies: number; available: number; waiting: number; branches: PortalBranchStockDto[];
}

export class PortalError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * Plain fetch, not the app's API client: that one attaches a staff token and sends a 401 to the
 * staff login page. A member is not a user of the application, and their session is this
 * portal's own — sent in its own header, never as a bearer token.
 */
async function call<T>(slug: string, path: string, token: string | null, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}/portal/${encodeURIComponent(slug)}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Member-Token": token } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;

  const firstFieldError = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
  const message =
    res.status === 429 ? "Too many attempts. Please wait a minute and try again."
    : data?.description ?? data?.Description ?? data?.failures?.[0]?.errorMessage ?? firstFieldError
      ?? data?.detail ?? data?.title ?? "Something went wrong. Please try again.";
  throw new PortalError(message, res.status);
}

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const portalApi = {
  info:    (slug: string): Promise<PortalInfoDto> => call(slug, "", null),
  signIn:  (slug: string, memberNumber: string, pin: string): Promise<PortalSessionDto> =>
    call(slug, "/sign-in", null, { method: "POST", body: { memberNumber, pin } }),
  changePin: (slug: string, token: string, currentPin: string, newPin: string): Promise<PortalSessionDto> =>
    call(slug, "/change-pin", token, { method: "POST", body: { currentPin, newPin } }),
  account: (slug: string, token: string): Promise<PortalAccountDto> =>
    call(slug, `/account${query({ today: localToday() })}`, token),
  search:  (slug: string, token: string | null, search: string, page: number): Promise<{ items: PortalTitleDto[]; total: number }> =>
    call(slug, `/search${query({ search, page })}`, token),
  renew:   (slug: string, token: string, loanId: string): Promise<PortalLoanDto> =>
    call(slug, `/loans/${loanId}/renew`, token, { method: "POST", body: { today: localToday() } }),
  reserve: (slug: string, token: string, titleId: string, pickupBranchId: string): Promise<PortalReservationDto> =>
    call(slug, "/reservations", token, { method: "POST", body: { titleId, pickupBranchId, today: localToday() } }),
  cancelReservation: (slug: string, token: string, id: string): Promise<void> =>
    call(slug, `/reservations/${id}/cancel`, token, { method: "POST", body: { today: localToday() } }),
};
