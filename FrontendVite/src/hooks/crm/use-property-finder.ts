import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  propertyFinderApi,
  PF_ROLE_TEMPLATES,
  type ImportLeadsRequest,
  propertyFinderSyncApi,
  propertyFinderCredentialsApi,
  type PfAgentDto,
} from "@/lib/crm/property-finder.api";
import { rolesApi, permissionsApi } from "@/lib/identity/roles.api";
import { teamsApi } from "@/lib/identity/teams.api";
import { usersApi } from "@/lib/identity/users.api";
import { integrationsApi } from "@/lib/crm/integrations.api";
import type { RoleSummaryDto } from "@/lib/identity/types";

const QK = "property-finder";

/**
 * Read-only picture of the connected Property Finder account.
 *
 * `staleTime: Infinity` on purpose — this walks every page of leads and users on the far side,
 * which takes seconds and costs API quota. It is a deliberate action, not something to refetch on
 * a window focus, so the caller refreshes it explicitly.
 */
export function usePropertyFinderPreview(enabled: boolean) {
  return useQuery({
    queryKey: [QK, "preview"],
    queryFn: propertyFinderApi.preview,
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false, // a missing scope or bad key will not fix itself on a retry
  });
}

export function useImportPropertyFinderLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportLeadsRequest) => propertyFinderApi.importLeads(body),
    onSuccess: (_r, body) => {
      if (body.dryRun) return;
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
    // No toast here: the import runs as a loop of batches, so a per-call toast would fire dozens
    // of times. The caller reports the totals once, at the end.
    onError: () => { /* surfaced by the caller, which also keeps the resume cursor */ },
  });
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export interface EnsureRolesResult {
  roleIdByName: Record<string, string>;
  created: string[];
  missingPermissions: string[];
  /** The tenant-wide role provisioned with the workspace, reused for the CRM Manager. */
  crmManagerRoleId: string | null;
}

/**
 * Creates the two Property Finder roles if they do not already exist, then sets their permissions.
 *
 * Idempotent by name: re-running finds the existing role and re-applies its permissions rather than
 * creating a duplicate. Any permission key that is not seeded in this deployment is reported rather
 * than silently dropped — a role quietly missing `crm.leads-assigned.view` would leave every
 * imported agent unable to see their own leads, which is hard to spot afterwards.
 */
export function useEnsurePropertyFinderRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<EnsureRolesResult> => {
      const [allPermissions, existing] = await Promise.all([
        permissionsApi.getAll(),
        rolesApi.getAll({ pageSize: 200 }),
      ]);

      const idByKey = new Map(allPermissions.map(p => [p.key.toLowerCase(), p.id]));
      const byName = new Map(
        (existing.items as RoleSummaryDto[]).map(r => [r.name.trim().toLowerCase(), r]));

      const roleIdByName: Record<string, string> = {};
      const created: string[] = [];
      const missing: string[] = [];

      for (const template of Object.values(PF_ROLE_TEMPLATES)) {
        let roleId = byName.get(template.role.toLowerCase())?.id;
        if (!roleId) {
          const made = await rolesApi.create(template.role, template.description);
          roleId = made.id;
          created.push(template.role);
        }

        const ids: string[] = [];
        for (const key of template.permissions) {
          const id = idByKey.get(key.toLowerCase());
          if (id) ids.push(id);
          else if (!missing.includes(key)) missing.push(key);
        }
        await rolesApi.updatePermissions(roleId, ids);
        roleIdByName[template.role] = roleId;
      }

      // Reused, not recreated: every tenant is provisioned with a CRM Manager role already, and a
      // second role by the same name would be indistinguishable in the roles list.
      const crmManagerRoleId = byName.get("crm manager")?.id ?? null;

      return { roleIdByName, created, missingPermissions: missing, crmManagerRoleId };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface ProvisionOutcome {
  agent: PfAgentDto;
  userId: string | null;
  userName: string;
  status: "created" | "linked" | "skipped" | "failed";
  detail?: string;
}

/**
 * Turns Property Finder agents into Vrodux logins.
 *
 * Three rules that matter:
 *  • An agent whose email already has a login **in this workspace** is LINKED, not re-created —
 *    re-running the import must never mint a second account for the same person.
 *  • An email belonging to another workspace is skipped with a reason. Logins are unique
 *    platform-wide, so there is no way to create it here and pretending otherwise would just fail
 *    mid-run.
 *  • Users are created one at a time, sequentially. Each consumes a plan seat and may send an
 *    invite email; firing 69 of those in parallel makes a seat-limit failure impossible to
 *    attribute, and hammers the mail server.
 */
export function useProvisionPropertyFinderAgents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      agents: PfAgentDto[];
      roleIdByName: Record<string, string>;
      sendInvite: boolean;
      onProgress?: (done: number, total: number, current: string) => void;
    }): Promise<ProvisionOutcome[]> => {
      const { agents, roleIdByName, sendInvite, onProgress } = input;

      // One lookup of existing logins, so linking does not cost a request per agent.
      const existing = await usersApi.getAll({ pageSize: 200 });
      const byEmail = new Map(
        existing.items.map(u => [u.email.trim().toLowerCase(), u]));

      const results: ProvisionOutcome[] = [];
      // Logins minted during THIS run, so a duplicate email inside Property Finder links rather
      // than failing against the platform-wide unique index.
      const createdThisRun = new Map<string, { id: string; name: string }>();
      let done = 0;

      for (const agent of agents) {
        onProgress?.(done, agents.length, agent.fullName);
        done++;

        const email = agent.email?.trim().toLowerCase();
        if (!email) {
          results.push({ agent, userId: null, userName: agent.fullName, status: "skipped",
            detail: "No email address in Property Finder — a login needs one." });
          continue;
        }

        const already = byEmail.get(email);
        if (already) {
          results.push({ agent, userId: already.id, userName: already.fullName, status: "linked" });
          continue;
        }

        // Property Finder itself can hold the same address on two users (one active, one not).
        // Without this, the second would be sent to the API and come back "already registered" as
        // a failure — noise for something we can see coming. Link it to the login just created.
        const madeThisRun = createdThisRun.get(email);
        if (madeThisRun) {
          results.push({ agent, userId: madeThisRun.id, userName: madeThisRun.name, status: "linked",
            detail: "Shares an email with another Property Finder user — linked to the same login." });
          continue;
        }

        if (agent.emailInUse) {
          results.push({ agent, userId: null, userName: agent.fullName, status: "skipped",
            detail: agent.emailInUseNote ?? "Email already belongs to a login in another workspace." });
          continue;
        }

        const roleId = agent.suggestedRole ? roleIdByName[agent.suggestedRole] : undefined;
        const [firstName, ...rest] = agent.fullName.split(/\s+/);

        try {
          const provisioned = await usersApi.provision({
            email:     agent.email!,
            username:  email,
            firstName: firstName || agent.fullName,
            lastName:  rest.join(" "),
            roleIds:   roleId ? [roleId] : [],
            sendInvite,
          });
          createdThisRun.set(email, { id: provisioned.user.id, name: provisioned.user.fullName });
          results.push({
            agent,
            userId:   provisioned.user.id,
            userName: provisioned.user.fullName,
            status:   "created",
            detail:   provisioned.inviteSent
              ? "Invite emailed."
              : provisioned.temporaryPassword
                ? `Temporary password: ${provisioned.temporaryPassword}`
                : provisioned.inviteError ?? undefined,
          });
        } catch (e) {
          results.push({ agent, userId: null, userName: agent.fullName, status: "failed",
            detail: e instanceof Error ? e.message : String(e) });
        }
      }

      onProgress?.(agents.length, agents.length, "");
      return results;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Creates a login for someone who is NOT in Property Finder — the CRM Manager and any team lead
 * hired since, who have no PF account to import from.
 *
 * Reuses an existing login when the email already belongs to one in this workspace, so re-running
 * the import does not fail on "already registered" or mint a duplicate.
 */
export function useCreateStandaloneUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fullName: string; email: string; roleId?: string; sendInvite: boolean;
    }): Promise<{ userId: string; userName: string; created: boolean; temporaryPassword?: string | null }> => {
      const email = input.email.trim().toLowerCase();

      const existing = await usersApi.getAll({ search: email, pageSize: 20 });
      const match = existing.items.find(u => u.email.trim().toLowerCase() === email);
      if (match) return { userId: match.id, userName: match.fullName, created: false };

      const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
      const provisioned = await usersApi.provision({
        email: input.email.trim(),
        username: email,
        firstName: firstName || input.fullName.trim(),
        lastName: rest.join(" "),
        roleIds: input.roleId ? [input.roleId] : [],
        sendInvite: input.sendInvite,
      });
      return {
        userId: provisioned.user.id,
        userName: provisioned.user.fullName,
        created: true,
        temporaryPassword: provisioned.temporaryPassword,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Team ──────────────────────────────────────────────────────────────────────

/**
 * Creates (or reuses) the team every imported lead is filed to.
 *
 * The team is not decoration: since Module 31 a lead with no team is visible only to its owner and
 * to full-access roles, so without this the decision makers would see nothing at all.
 */
export function useEnsurePropertyFinderTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; leadUserId?: string | null; memberUserIds: string[] }) => {
      const existing = await teamsApi.getAll(input.name);
      const match = existing.find(t => t.name.trim().toLowerCase() === input.name.trim().toLowerCase());
      if (match) {
        // Additive: never drop members a re-run did not happen to include.
        const current = new Set((match.members ?? []).map(m => m.userId));
        for (const userId of input.memberUserIds) {
          if (!current.has(userId)) {
            try { await teamsApi.addMember(match.id, userId); } catch { /* already a member */ }
          }
        }
        return match;
      }
      return teamsApi.create({
        name: input.name,
        description: "Imported from Property Finder.",
        teamLeadUserId: input.leadUserId ?? null,
        memberUserIds: input.memberUserIds,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Live sync ─────────────────────────────────────────────────────────────────

/**
 * Finds this tenant's Property Finder integration, which owns the inbound URL Property Finder
 * will call. It is created through Settings → Integrations, not here — this only locates it, so
 * the import screen can say plainly when it does not exist yet.
 */
export function usePropertyFinderIntegration() {
  return useQuery({
    queryKey: [QK, "integration"],
    queryFn: async () => {
      const all = await integrationsApi.getAll();
      return all.find(i => i.providerKey === "property-finder") ?? null;
    },
    staleTime: 60 * 1000,
  });
}

/** Whether new enquiries arrive on their own — answered by Property Finder, not by a local flag. */
export function usePropertyFinderSyncStatus(integrationId: string | null | undefined) {
  return useQuery({
    queryKey: [QK, "sync-status", integrationId],
    queryFn: () => propertyFinderSyncApi.status(integrationId!),
    enabled: !!integrationId,
    retry: false,
  });
}

export function useSubscribePropertyFinderSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) => propertyFinderSyncApi.subscribe(integrationId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK, "sync-status"] });
      // Subscribing records a sync success on the integration, which the header also shows.
      qc.invalidateQueries({ queryKey: ["crm-integrations"] });
      if (r.live) toast.success("Live sync is on — new enquiries will arrive automatically.");
      else if (r.blocker) toast.error(r.blocker);
      else toast.warning(`Still missing: ${r.missingEvents.join(", ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Saves this workspace's own Property Finder key, after the server has verified it works. */
export function useSetPropertyFinderCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { integrationId: string; apiKey: string; apiSecret: string }) =>
      propertyFinderCredentialsApi.set(v.integrationId, v.apiKey, v.apiSecret),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      // The save marks the integration connected. The drawer header renders from the integrations
      // cache, so without this it keeps showing the pre-save status — "Not Connected" next to a
      // badge saying the key is stored.
      qc.invalidateQueries({ queryKey: ["crm-integrations"] });
      toast.success("Property Finder key saved and verified.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
