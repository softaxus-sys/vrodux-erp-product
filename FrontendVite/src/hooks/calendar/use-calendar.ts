import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calendarApi, type EventRequest } from "@/lib/calendar/calendar.api";

const QK = "calendar";

/**
 * Events in a window. Re-fetched every minute: Google changes are pulled by the server every few
 * minutes, and this is how they show up without the user pressing anything.
 */
export function useCalendarEvents(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: [QK, "events", fromUtc, toUtc],
    queryFn: () => calendarApi.getEvents(fromUtc, toUtc),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function useEventMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "events"] }); toast.success(success); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateEvent = () =>
  useEventMutation((r: EventRequest) => calendarApi.createEvent(r), "Event added to your calendar.");

export const useUpdateEvent = () =>
  useEventMutation((a: { id: string; request: EventRequest }) => calendarApi.updateEvent(a.id, a.request), "Event updated.");

export const useDeleteEvent = () =>
  useEventMutation((id: string) => calendarApi.deleteEvent(id), "Event deleted.");

export function useGoogleConnection() {
  return useQuery({ queryKey: [QK, "google"], queryFn: calendarApi.getConnection, staleTime: 30_000 });
}

export function useConnectGoogle() {
  return useMutation({
    mutationFn: calendarApi.connect,
    // Hand the browser to Google's consent screen; it returns to /calendar?google=connected.
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: calendarApi.disconnect,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success("Google Calendar disconnected."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: calendarApi.sync,
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (r.error) toast.error(r.error);
      else toast.success(r.created + r.updated + r.removed === 0 ? "Already up to date." : `Synced: ${r.created} new, ${r.updated} updated, ${r.removed} removed.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
