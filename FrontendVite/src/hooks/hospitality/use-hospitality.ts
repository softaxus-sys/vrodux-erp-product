import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hospitalityApi } from "@/lib/hospitality/hospitality.api";

const QK = "hospitality";

export function useRooms() {
  return useQuery({
    queryKey: [QK, "rooms"],
    queryFn:  hospitalityApi.getRooms,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoomsSummary() {
  return useQuery({
    queryKey: [QK, "rooms-summary"],
    queryFn:  hospitalityApi.getRoomsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBookings() {
  return useQuery({
    queryKey: [QK, "bookings"],
    queryFn:  hospitalityApi.getBookings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBookingsSummary() {
  return useQuery({
    queryKey: [QK, "bookings-summary"],
    queryFn:  hospitalityApi.getBookingsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHKTasks() {
  return useQuery({
    queryKey: [QK, "hk-tasks"],
    queryFn:  hospitalityApi.getHKTasks,
    staleTime: 2 * 60 * 1000,
  });
}

export function useHKSummary() {
  return useQuery({
    queryKey: [QK, "hk-summary"],
    queryFn:  hospitalityApi.getHKSummary,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => hospitalityApi.createRoom(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "rooms"] }); qc.invalidateQueries({ queryKey: [QK, "rooms-summary"] }); toast.success("Room added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => hospitalityApi.createBooking(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "bookings"] }); qc.invalidateQueries({ queryKey: [QK, "bookings-summary"] }); toast.success("Booking confirmed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateHKTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => hospitalityApi.createHKTask(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "hk-tasks"] }); qc.invalidateQueries({ queryKey: [QK, "hk-summary"] }); toast.success("Task created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
