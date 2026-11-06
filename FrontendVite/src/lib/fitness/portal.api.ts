import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { localToday, localTime } from "./fitness.api";

const BASE = `${getApiBaseUrl()}/api/fitness`;

// Staff side

export interface PortalSettingsDto { enabled: boolean; allowBooking: boolean; membersWithAccess: number }
/** The PIN is in this response once and cannot be read again. */
export interface MemberPortalPinDto { memberNumber: string; pin: string }

export const portalAdminApi = {
  getSettings:    (): Promise<PortalSettingsDto> => rawApiClient.get(`${BASE}/portal-settings`),
  updateSettings: (body: { enabled: boolean; allowBooking: boolean }): Promise<PortalSettingsDto> => rawApiClient.put(`${BASE}/portal-settings`, body),
  setPin:         (memberId: string): Promise<MemberPortalPinDto> => rawApiClient.post(`${BASE}/members/${memberId}/portal-pin`, {}),
  clearPin:       (memberId: string): Promise<void> => rawApiClient.delete(`${BASE}/members/${memberId}/portal-pin`),
};

/** The address members open. */
export const portalUrl = (slug: string) => `${window.location.origin}/gym-portal/${slug}`;

// Member side

export interface PortalInfoDto { gymName: string; allowBooking: boolean; currency: string | null }
export interface PortalSessionDto { token: string; expiresAt: string; fullName: string; memberNumber: string }
export interface PortalMembershipDto {
  id: string; planName: string; startDate: string; endDate: string; state: string;
  classCreditsLeft: number | null; ptSessionsLeft: number; balance: number; frozenFrom: string | null;
}
export interface PortalBookingDto { id: string; sessionId: string; className: string | null; date: string | null; startTime: string | null; status: string; waitlistPosition: number | null }
export interface PortalPaymentDto { receiptNumber: string; paidOn: string; amount: number; method: string }
export interface PortalVisitDto { date: string; checkedInAt: string; branchName: string | null }
export interface PortalClassDto {
  id: string; className: string; trainerName: string | null; branchName: string | null; date: string;
  startTime: string; endTime: string; seatsLeft: number; waitlisted: number; bookedByMe: boolean;
}
export interface PortalAccountDto {
  fullName: string; memberNumber: string; status: string; homeBranchName: string | null; trainerName: string | null;
  balance: number; visits30Days: number; lastVisit: string | null;
  memberships: PortalMembershipDto[]; bookings: PortalBookingDto[]; payments: PortalPaymentDto[]; visits: PortalVisitDto[];
}

export class PortalError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * Plain fetch, not the app's API client: that one attaches a staff token and sends a 401 to the
 * staff login page. A member is not a user of the application, and their session is this
 * portal's own, sent in its own header and never as a bearer token.
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

export const portalApi = {
  info:   (slug: string): Promise<PortalInfoDto> => call(slug, "", null),
  signIn: (slug: string, memberNumber: string, pin: string): Promise<PortalSessionDto> =>
    call(slug, "/sign-in", null, { method: "POST", body: { memberNumber, pin } }),
  changePin: (slug: string, token: string, currentPin: string, newPin: string): Promise<PortalSessionDto> =>
    call(slug, "/change-pin", token, { method: "POST", body: { currentPin, newPin } }),
  account: (slug: string, token: string): Promise<PortalAccountDto> =>
    call(slug, `/account?today=${localToday()}`, token),
  classes: (slug: string, token: string): Promise<PortalClassDto[]> =>
    call(slug, `/classes?today=${localToday()}`, token),
  book: (slug: string, token: string, sessionId: string): Promise<PortalBookingDto> =>
    call(slug, "/bookings", token, { method: "POST", body: { sessionId, today: localToday(), localTime: localTime() } }),
  cancel: (slug: string, token: string, bookingId: string): Promise<void> =>
    call(slug, `/bookings/${bookingId}/cancel`, token, { method: "POST", body: { today: localToday(), localTime: localTime() } }),
};
