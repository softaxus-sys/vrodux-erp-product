import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toursApi } from "@/lib/tours.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "tours" as const;

export function useTourDashboard(enabled = true) {
  return useQuery({ queryKey: [QK, "dashboard"], queryFn: toursApi.dashboard, enabled, refetchInterval: 60_000 });
}

export function useTourPackages(enabled = true) {
  return useQuery({ queryKey: [QK, "packages"], queryFn: toursApi.packages, enabled });
}

export function useTourDepartures(enabled = true) {
  return useQuery({ queryKey: [QK, "departures"], queryFn: toursApi.departures, enabled });
}

export function useTourBookingsList() {
  return usePagedVerticalList([QK, "bookings"], toursApi.bookings);
}

export function useTourBooking(id: string) {
  return useQuery({ queryKey: [QK, "booking", id], queryFn: () => toursApi.booking(id), enabled: Boolean(id) });
}

function useInvalidateTours() {
  const qc = useQueryClient();
  return (id?: string) => {
    if (id) qc.invalidateQueries({ queryKey: [QK, "booking", id] });
    qc.invalidateQueries({ queryKey: [QK, "bookings"] });
    qc.invalidateQueries({ queryKey: [QK, "dashboard"] });
  };
}

export function useTourStatus() {
  const invalidate = useInvalidateTours();
  return useMutation({
    mutationFn: (v: { id: string; action: "confirm" | "complete" | "reopen" | "cancel"; reason?: string }) =>
      toursApi.setStatus(v.id, v.action, v.reason),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}

export function useTourPayment() {
  const invalidate = useInvalidateTours();
  return useMutation({
    mutationFn: (v: { id: string; amount: number; method: string; reference?: string | null }) =>
      toursApi.addPayment(v.id, { amount: v.amount, method: v.method, reference: v.reference ?? null }),
    onSuccess: (_d, v) => invalidate(v.id),
  });
}
