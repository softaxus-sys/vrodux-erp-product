import { useQuery } from "@tanstack/react-query";
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
