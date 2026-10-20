import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/calendar`;

export interface AttendeeDto { email: string; name?: string | null; responseStatus: string; }

export interface CalendarEventDto {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  /** UTC instants. For an all-day event: midnight UTC of the first day / of the day AFTER the last. */
  startUtc: string;
  endUtc: string;
  isAllDay: boolean;
  timeZone?: string | null;
  meetUrl?: string | null;
  source: "vrodux" | "google";
  canEdit: boolean;
  ownerName?: string | null;
  attendees: AttendeeDto[];
  syncStatus: "local" | "synced" | "error";
  syncError?: string | null;
}

export interface EventRequest {
  title: string;
  description?: string;
  location?: string;
  startUtc: string;
  endUtc: string;
  isAllDay: boolean;
  timeZone?: string;
  attendees: { email: string; name?: string }[];
  addMeet: boolean;
}

export interface ConnectionDto {
  configured: boolean;
  status: "disconnected" | "connected" | "error";
  accountEmail?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

export interface SyncResultDto { created: number; updated: number; removed: number; error?: string | null; }

export const calendarApi = {
  getEvents: (fromUtc: string, toUtc: string): Promise<CalendarEventDto[]> =>
    rawApiClient.get(`${BASE}/events?from=${encodeURIComponent(fromUtc)}&to=${encodeURIComponent(toUtc)}`),
  createEvent: (r: EventRequest): Promise<CalendarEventDto> => rawApiClient.post(`${BASE}/events`, r),
  updateEvent: (id: string, r: EventRequest): Promise<CalendarEventDto> => rawApiClient.put(`${BASE}/events/${id}`, r),
  deleteEvent: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/events/${id}`),

  getConnection: (): Promise<ConnectionDto> => rawApiClient.get(`${BASE}/google`),
  connect: (): Promise<{ url: string }> => rawApiClient.post(`${BASE}/google/connect`, {}),
  disconnect: (): Promise<void> => rawApiClient.post(`${BASE}/google/disconnect`, {}),
  sync: (): Promise<SyncResultDto> => rawApiClient.post(`${BASE}/google/sync`, {}),
};
