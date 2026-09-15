import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hospitalityApi } from "@/lib/hospitality.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "hospitality" as const;
const PAGE_SIZE = 25;

export function useRoomsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "rooms", "summary"], queryFn: hospitalityApi.getRoomsSummary, enabled });
}

export function useRooms(enabled = true) {
  return useQuery({ queryKey: [QK, "rooms"], queryFn: hospitalityApi.getRooms, enabled, refetchInterval: 30_000 });
}

export function useBookingsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "bookings", "summary"], queryFn: hospitalityApi.getBookingsSummary, enabled });
}

export function useBookingsList(enabled = true) {
  return usePagedVerticalList([QK, "bookings"], hospitalityApi.getBookings, enabled);
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hospitalityApi.checkIn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bookings"] });
      qc.invalidateQueries({ queryKey: [QK, "rooms"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hospitalityApi.checkOut(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "bookings"] });
      qc.invalidateQueries({ queryKey: [QK, "rooms"] });
    },
  });
}

export function useHousekeepingSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "housekeeping", "summary"], queryFn: hospitalityApi.getHousekeepingSummary, enabled });
}

/** Not built on usePagedVerticalList -- housekeeping's list endpoint takes an extra `taskType`
 *  filter the shared hook's params shape doesn't carry, so this stays a small bespoke copy of the
 *  same page/search/status/accumulate pattern rather than complicating the shared one for a
 *  single caller. */
export function useHousekeepingList(enabled = true) {
  const [status, setStatus] = useState("all");
  const [taskType, setTaskType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<import("@/types/hospitality").HousekeepingTaskDto[]>([]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    taskType: taskType === "all" ? undefined : taskType,
  };

  const query = useQuery({
    queryKey: [QK, "housekeeping", params],
    queryFn: () => hospitalityApi.getHousekeepingTasks(params),
    enabled,
  });

  useEffect(() => setPage(1), [status, taskType, search]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data!.page === 1 ? query.data!.items : [...prev, ...query.data!.items]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  return {
    items,
    status,
    setStatus,
    taskType,
    setTaskType,
    search,
    setSearch,
    hasMore,
    loadMore: () => hasMore && !query.isFetching && setPage((p) => p + 1),
    refresh: () => (page === 1 ? query.refetch() : setPage(1)),
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
  };
}

function invalidateHousekeeping(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QK, "housekeeping"] });
}

export function useStartTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => hospitalityApi.startTask(id), onSuccess: () => invalidateHousekeeping(qc) });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => hospitalityApi.completeTask(id), onSuccess: () => invalidateHousekeeping(qc) });
}

export function useVerifyTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => hospitalityApi.verifyTask(id), onSuccess: () => invalidateHousekeeping(qc) });
}
