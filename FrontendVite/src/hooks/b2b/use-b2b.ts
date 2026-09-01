import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { b2bApi, type CreateProposalReq, type CreateContractReq, type CreateTicketReq, type VerticalPageParams } from "@/lib/b2b/b2b.api";

const QK = "b2b";

export function useB2BSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: b2bApi.getSummary }); }
export function useProposals(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "proposals"], params],
    queryFn: () => b2bApi.getProposals(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useServiceContracts(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "contracts"], params],
    queryFn: () => b2bApi.getContracts(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useSupportTickets(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "tickets"], params],
    queryFn: () => b2bApi.getTickets(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}

function useM<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["proposals"], ["contracts"], ["tickets"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateProposal()    { return useM((d: CreateProposalReq) => b2bApi.createProposal(d), "Proposal created."); }
export function useSetProposalStatus() { return useM(({ id, status }: { id: string; status: string }) => b2bApi.setProposalStatus(id, status), "Proposal updated."); }
export function useDeleteProposal()    { return useM((id: string) => b2bApi.deleteProposal(id), "Proposal removed."); }

export function useCreateServiceContract() { return useM((d: CreateContractReq) => b2bApi.createContract(d), "Contract created."); }
export function useSetServiceContractStatus() { return useM(({ id, status }: { id: string; status: string }) => b2bApi.setContractStatus(id, status), "Contract updated."); }
export function useDeleteServiceContract() { return useM((id: string) => b2bApi.deleteContract(id), "Contract removed."); }

export function useCreateSupportTicket() { return useM((d: CreateTicketReq) => b2bApi.createTicket(d), "Ticket created."); }
export function useResolveTicket()       { return useM(({ id, resolution }: { id: string; resolution?: string | null }) => b2bApi.resolveTicket(id, resolution), "Ticket resolved."); }
export function useSetTicketStatus()     { return useM(({ id, status }: { id: string; status: string }) => b2bApi.setTicketStatus(id, status), "Ticket updated."); }
export function useDeleteSupportTicket() { return useM((id: string) => b2bApi.deleteTicket(id), "Ticket removed."); }
