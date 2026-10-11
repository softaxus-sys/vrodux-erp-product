import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hospitalityApi, type HospPageParams, type HKTaskParams, type CreateBookingRequest } from "@/lib/hospitality/hospitality.api";

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

export function useBookings(params: HospPageParams & { search?: string } = {}) {
  return useQuery({
    queryKey: [QK, "bookings", params],
    queryFn:  () => hospitalityApi.getBookings(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
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

export function useHKTasks(params: HKTaskParams = {}) {
  return useQuery({
    queryKey: [QK, "hk-tasks", params],
    queryFn:  () => hospitalityApi.getHKTasks(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
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
    mutationFn: (data: CreateBookingRequest) => hospitalityApi.createBooking(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "bookings"] }); qc.invalidateQueries({ queryKey: [QK, "bookings-summary"] }); toast.success("Booking confirmed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useStayChange(kind: "in" | "out") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (kind === "in" ? hospitalityApi.checkInBooking(id) : hospitalityApi.checkOutBooking(id)),
    onSuccess: () => {
      // A stay changes the booking, the room's status and the housekeeping list.
      for (const k of ["bookings", "bookings-summary", "rooms", "rooms-summary", "housekeeping"]) qc.invalidateQueries({ queryKey: [QK, k] });
      toast.success(kind === "in" ? "Guest checked in." : "Guest checked out.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
export const useCheckInBooking = () => useStayChange("in");
export const useCheckOutBooking = () => useStayChange("out");

export function useRecordBookingPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; amount: number; method: string; reference?: string | null }) =>
      hospitalityApi.recordBookingPayment(v.id, { amount: v.amount, method: v.method, reference: v.reference }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bookings"] });
      qc.invalidateQueries({ queryKey: [QK, "bookings-summary"] });
      toast.success("Payment recorded.");
    },
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
