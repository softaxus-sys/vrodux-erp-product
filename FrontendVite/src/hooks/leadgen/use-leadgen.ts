import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  isSearchActive, leadgenApi,
  type CampaignInput, type ConnectImapInput, type CreateProspectInput, type PackInput, type PlatformSettingsDto,
  type ProfileInput, type ProspectFilter, type SearchInput, type ThreadFilter,
} from "@/lib/leadgen/leadgen.api";

const QK = "leadgen";
const msg = (key: string, vars?: Record<string, unknown>) => i18n.t(`toast.${key}`, { ns: "leadgen", ...vars });

/**
 * Almost everything in this module is connected: revealing a prospect changes the balance, the
 * prospect list, the dashboard and the search's "revealed" count; sending changes the inbox and the
 * campaign. So a mutation refreshes the whole `leadgen` cache rather than guessing what went stale.
 */
function useLeadGenMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, successKey?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); if (successKey) toast.success(msg(successKey)); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Setup ───────────────────────────────────────────────────────────────────

export const useMeta = (enabled = true) =>
  useQuery({ queryKey: [QK, "meta"], queryFn: leadgenApi.getMeta, enabled, staleTime: 30_000 });

export const useProfile = (enabled = true) =>
  useQuery({ queryKey: [QK, "profile"], queryFn: leadgenApi.getProfile, enabled, staleTime: 60_000 });
export const useUpdateProfile = () => useLeadGenMutation((r: ProfileInput) => leadgenApi.updateProfile(r), "profileSaved");

export const useDashboard = (days: number, enabled = true) =>
  useQuery({ queryKey: [QK, "dashboard", days], queryFn: () => leadgenApi.getDashboard(days), enabled, staleTime: 30_000 });

export const useSuppressions = (p: { search?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({
    queryKey: [QK, "suppressions", p.search ?? "", p.page ?? 1, p.pageSize ?? 50],
    queryFn: () => leadgenApi.getSuppressions(p), enabled, placeholderData: keepPreviousData,
  });
export const useAddSuppression = () =>
  useLeadGenMutation((a: { kind: string; value: string; reason?: string }) => leadgenApi.addSuppression(a.kind, a.value, a.reason), "suppressionAdded");
export const useImportSuppressions = () => useLeadGenMutation((values: string[]) => leadgenApi.importSuppressions(values));
export const useRemoveSuppression = () => useLeadGenMutation((id: string) => leadgenApi.removeSuppression(id), "suppressionRemoved");

// ── Searches ────────────────────────────────────────────────────────────────

/** Polls every 3 seconds while a search is queued or running, and stops on its own once all are done. */
export const useSearches = (enabled = true) =>
  useQuery({
    queryKey: [QK, "searches"], queryFn: leadgenApi.getSearches, enabled, staleTime: 5_000,
    refetchInterval: q => (q.state.data?.some(isSearchActive) ? 3_000 : false),
  });
export const useEstimateSearch = () => useMutation({ mutationFn: (r: SearchInput) => leadgenApi.estimateSearch(r) });
export const useCreateSearch = () => useLeadGenMutation((r: SearchInput) => leadgenApi.createSearch(r), "searchStarted");
export const useCancelSearch = () => useLeadGenMutation((id: string) => leadgenApi.cancelSearch(id), "searchCancelled");
export const useDeleteSearch = () =>
  useLeadGenMutation((a: { id: string; deleteUnrevealed?: boolean }) => leadgenApi.deleteSearch(a.id, a.deleteUnrevealed ?? true), "searchDeleted");

// ── Prospects ───────────────────────────────────────────────────────────────

export const useProspects = (f: ProspectFilter, enabled = true) =>
  useQuery({
    queryKey: [QK, "prospects", f], queryFn: () => leadgenApi.getProspects(f),
    enabled, staleTime: 15_000, placeholderData: keepPreviousData,
  });
export const useProspectStats = (searchId?: string, enabled = true) =>
  useQuery({ queryKey: [QK, "prospect-stats", searchId ?? ""], queryFn: () => leadgenApi.getProspectStats(searchId), enabled, staleTime: 15_000 });
export const useProspect = (id: string | null) =>
  useQuery({ queryKey: [QK, "prospect", id], queryFn: () => leadgenApi.getProspect(id!), enabled: !!id });

export const useCreateProspect = () => useLeadGenMutation((r: CreateProspectInput) => leadgenApi.createProspect(r), "prospectAdded");
export const useUpdateProspect = () =>
  useLeadGenMutation((a: { id: string; status?: string; notes?: string; ownerUserId?: string; ownerName?: string; clearOwner?: boolean }) => {
    const { id, ...rest } = a;
    return leadgenApi.updateProspect(id, rest);
  }, "prospectSaved");
export const useBulkProspects = () => useLeadGenMutation((r: Parameters<typeof leadgenApi.bulkProspects>[0]) => leadgenApi.bulkProspects(r));
/** No default toast: the caller shows the outcome (revealed / refunded / out of credits). */
export const useRevealProspects = () => useLeadGenMutation((ids: string[]) => leadgenApi.revealProspects(ids));
export const useImportToCrm = () => useLeadGenMutation((ids: string[]) => leadgenApi.importToCrm(ids));
export const useAddContact = () =>
  useLeadGenMutation((a: { id: string; fullName: string; title?: string; email?: string; phone?: string }) => {
    const { id, ...rest } = a;
    return leadgenApi.addContact(id, rest);
  }, "contactAdded");
export const useDeleteContact = () => useLeadGenMutation((a: { id: string; contactId: string }) => leadgenApi.deleteContact(a.id, a.contactId));

// ── Credits ─────────────────────────────────────────────────────────────────

export const useWallet = (enabled = true) =>
  useQuery({ queryKey: [QK, "wallet"], queryFn: leadgenApi.getWallet, enabled, staleTime: 15_000 });
export const useLedger = (p: { type?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: [QK, "ledger", p.type ?? "", p.page ?? 1], queryFn: () => leadgenApi.getLedger(p), enabled, placeholderData: keepPreviousData });
export const usePacks = (enabled = true) =>
  useQuery({ queryKey: [QK, "packs"], queryFn: leadgenApi.getPacks, enabled, staleTime: 5 * 60_000 });
export const usePurchases = (enabled = true) =>
  useQuery({ queryKey: [QK, "purchases"], queryFn: leadgenApi.getPurchases, enabled });
export const usePaymentOptions = (enabled = true) =>
  useQuery({ queryKey: [QK, "payment-options"], queryFn: leadgenApi.getPaymentOptions, enabled, staleTime: 5 * 60_000 });
export const useCheckout = () =>
  useMutation({
    mutationFn: (a: { packId: string; provider: "stripe" | "paypal"; returnPath: string }) => leadgenApi.checkout(a.packId, a.provider, a.returnPath),
    onError: (e: Error) => toast.error(e.message),
  });
export const useConfirmPayPal = () => useLeadGenMutation((orderId: string) => leadgenApi.confirmPayPal(orderId));
export const useSetLowBalanceAlert = () => useLeadGenMutation((t: number | null) => leadgenApi.setLowBalanceAlert(t), "alertSaved");

// ── Mailboxes ───────────────────────────────────────────────────────────────

export const useMailboxes = (enabled = true) =>
  useQuery({ queryKey: [QK, "mailboxes"], queryFn: leadgenApi.getMailboxes, enabled, staleTime: 15_000 });
export const useMailboxProviders = (enabled = true) =>
  useQuery({ queryKey: [QK, "mailbox-providers"], queryFn: leadgenApi.getMailboxProviders, enabled, staleTime: 5 * 60_000 });
export const useConnectImap = () => useLeadGenMutation((r: ConnectImapInput) => leadgenApi.connectImap(r), "mailboxConnected");
export const useStartMailboxOAuth = () =>
  useMutation({
    mutationFn: (a: { provider: "google" | "microsoft"; returnPath: string }) => leadgenApi.startMailboxOAuth(a.provider, a.returnPath),
    onError: (e: Error) => toast.error(e.message),
  });
export const useUpdateMailbox = () =>
  useLeadGenMutation((a: { id: string; dailyLimit: number; signatureText?: string | null; displayName?: string | null }) => {
    const { id, ...rest } = a;
    return leadgenApi.updateMailbox(id, rest);
  }, "mailboxSaved");
export const usePauseMailbox = () => useLeadGenMutation((id: string) => leadgenApi.pauseMailbox(id), "mailboxPaused");
export const useResumeMailbox = () => useLeadGenMutation((id: string) => leadgenApi.resumeMailbox(id), "mailboxResumed");
export const useTestMailbox = () => useLeadGenMutation((a: { id: string; to: string }) => leadgenApi.testMailbox(a.id, a.to), "testSent");
export const useSyncMailbox = () => useLeadGenMutation((id: string) => leadgenApi.syncMailbox(id));
export const useDisconnectMailbox = () => useLeadGenMutation((id: string) => leadgenApi.disconnectMailbox(id), "mailboxDisconnected");

// ── Campaigns ───────────────────────────────────────────────────────────────

export const useCampaigns = (enabled = true) =>
  useQuery({ queryKey: [QK, "campaigns"], queryFn: leadgenApi.getCampaigns, enabled, staleTime: 10_000, refetchInterval: 20_000 });
export const useCampaign = (id: string | null) =>
  useQuery({ queryKey: [QK, "campaign", id], queryFn: () => leadgenApi.getCampaign(id!), enabled: !!id, refetchInterval: 20_000 });
export const useRecipients = (id: string | null, p: { status?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: [QK, "recipients", id, p.status ?? "", p.page ?? 1], queryFn: () => leadgenApi.getRecipients(id!, p),
    enabled: !!id, placeholderData: keepPreviousData, refetchInterval: 20_000,
  });
export const usePreviewEmail = (id: string | null, step: number, prospectId?: string) =>
  useQuery({ queryKey: [QK, "preview", id, step, prospectId ?? ""], queryFn: () => leadgenApi.previewEmail(id!, step, prospectId), enabled: !!id, staleTime: 0 });

export const useCreateCampaign = () => useLeadGenMutation((r: CampaignInput) => leadgenApi.createCampaign(r), "campaignSaved");
export const useUpdateCampaign = () => useLeadGenMutation((a: { id: string; input: CampaignInput }) => leadgenApi.updateCampaign(a.id, a.input), "campaignSaved");
export const useDeleteCampaign = () => useLeadGenMutation((id: string) => leadgenApi.deleteCampaign(id), "campaignDeleted");
export const useAddRecipients = () => useLeadGenMutation((a: { id: string; prospectIds: string[] }) => leadgenApi.addRecipients(a.id, a.prospectIds));
export const useRemoveRecipients = () => useLeadGenMutation((a: { id: string; recipientIds: string[] }) => leadgenApi.removeRecipients(a.id, a.recipientIds), "recipientsRemoved");
export const useStartCampaign = () => useLeadGenMutation((id: string) => leadgenApi.startCampaign(id), "campaignStarted");
export const usePauseCampaign = () => useLeadGenMutation((id: string) => leadgenApi.pauseCampaign(id), "campaignPaused");
export const useStopCampaign = () => useLeadGenMutation((id: string) => leadgenApi.stopCampaign(id), "campaignStopped");
export const useTestCampaign = () => useLeadGenMutation((a: { id: string; step: number; to: string }) => leadgenApi.testCampaign(a.id, a.step, a.to), "testSent");

// ── Inbox ───────────────────────────────────────────────────────────────────

export const useThreads = (f: ThreadFilter, enabled = true) =>
  useQuery({
    queryKey: [QK, "threads", f], queryFn: () => leadgenApi.getThreads(f),
    enabled, staleTime: 10_000, placeholderData: keepPreviousData, refetchInterval: 30_000,
  });
export const useThread = (id: string | null) =>
  useQuery({ queryKey: [QK, "thread", id], queryFn: () => leadgenApi.getThread(id!), enabled: !!id, refetchInterval: 30_000 });
export const useInboxCounts = (enabled = true) =>
  useQuery({ queryKey: [QK, "inbox-counts"], queryFn: leadgenApi.getInboxCounts, enabled, staleTime: 20_000, refetchInterval: 60_000 });
export const useReply = () => useLeadGenMutation((a: { id: string; body: string }) => leadgenApi.reply(a.id, a.body), "replySent");
export const useUpdateThread = () =>
  useLeadGenMutation((a: { id: string; classification?: string; assignedUserId?: string; assignedName?: string; clearAssignee?: boolean; archived?: boolean; markRead?: boolean }) => {
    const { id, ...rest } = a;
    return leadgenApi.updateThread(id, rest);
  });

// ── Platform admin ──────────────────────────────────────────────────────────

export const useAdminOverview = (enabled = true) =>
  useQuery({ queryKey: [QK, "admin-overview"], queryFn: leadgenApi.adminOverview, enabled, staleTime: 30_000 });
export const useAdminSettings = (enabled = true) =>
  useQuery({ queryKey: [QK, "admin-settings"], queryFn: leadgenApi.adminGetSettings, enabled });
export const useAdminUpdateSettings = () => useLeadGenMutation((s: PlatformSettingsDto) => leadgenApi.adminUpdateSettings(s), "settingsSaved");
export const useAdminPacks = (enabled = true) =>
  useQuery({ queryKey: [QK, "admin-packs"], queryFn: leadgenApi.adminGetPacks, enabled });
export const useAdminSavePack = () =>
  useLeadGenMutation((a: { id?: string; input: PackInput }) => (a.id ? leadgenApi.adminUpdatePack(a.id, a.input) : leadgenApi.adminCreatePack(a.input)), "packSaved");
export const useAdminDeletePack = () => useLeadGenMutation((id: string) => leadgenApi.adminDeletePack(id), "packDeleted");
export const useAdminGrant = () =>
  useLeadGenMutation((a: { tenantId: string; amount: number; reason: string }) => leadgenApi.adminGrant(a.tenantId, a.amount, a.reason), "creditsGranted");
