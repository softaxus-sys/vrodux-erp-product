import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hospitalityApi, type HKStatus } from "@/lib/hospitality/hospitality.api";

export const hospitalityKeys = {
  all:             ["hospitality"] as const,
  rooms:           (params?: object) => [...hospitalityKeys.all, "rooms", params ?? {}] as const,
  room:            (id: string) => [...hospitalityKeys.all, "room", id] as const,
  bookings:        (params?: object) => [...hospitalityKeys.all, "bookings", params ?? {}] as const,
  booking:         (id: string) => [...hospitalityKeys.all, "booking", id] as const,
  bookingSummary:  () => [...hospitalityKeys.all, "booking-summary"] as const,
  hkTasks:         (params?: object) => [...hospitalityKeys.all, "hk-tasks", params ?? {}] as const,
  hotelSummary:    () => [...hospitalityKeys.all, "hotel-summary"] as const,
};

export function useRooms(params?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: hospitalityKeys.rooms(params),
    queryFn:  () => hospitalityApi.getRooms(params),
  });
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: hospitalityKeys.room(id),
    queryFn:  () => hospitalityApi.getRoom(id),
    enabled:  !!id,
  });
}

export function useBookings(params?: { status?: string; checkIn?: string; checkOut?: string }) {
  return useQuery({
    queryKey: hospitalityKeys.bookings(params),
    queryFn:  () => hospitalityApi.getBookings(params),
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: hospitalityKeys.booking(id),
    queryFn:  () => hospitalityApi.getBooking(id),
    enabled:  !!id,
  });
}

export function useBookingSummary() {
  return useQuery({
    queryKey: hospitalityKeys.bookingSummary(),
    queryFn:  () => hospitalityApi.getBookingSummary(),
  });
}

export function useHKTasks(params?: { status?: string; assignedTo?: string }) {
  return useQuery({
    queryKey: hospitalityKeys.hkTasks(params),
    queryFn:  () => hospitalityApi.getHKTasks(params),
  });
}

export function useHotelSummary() {
  return useQuery({
    queryKey: hospitalityKeys.hotelSummary(),
    queryFn:  () => hospitalityApi.getHotelSummary(),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hospitalityApi.checkIn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hospitalityApi.checkOut(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}

export function useUpdateHKTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HKStatus }) =>
      hospitalityApi.updateHKTask(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hospitalityKeys.all });
    },
  });
}
