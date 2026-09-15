import { useQuery } from "@tanstack/react-query";
import { b2bApi } from "@/lib/b2b.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "b2b" as const;

export function useB2BSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "summary"], queryFn: b2bApi.getSummary, enabled });
}

export function useProposalsList(enabled = true) {
  return usePagedVerticalList([QK, "proposals"], b2bApi.getProposals, enabled);
}

export function useContractsList(enabled = true) {
  return usePagedVerticalList([QK, "contracts"], b2bApi.getContracts, enabled);
}

export function useTicketsList(enabled = true) {
  return usePagedVerticalList([QK, "tickets"], b2bApi.getTickets, enabled);
}
