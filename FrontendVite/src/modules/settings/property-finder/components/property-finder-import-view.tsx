import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2, RefreshCw, Users, ShieldCheck, UsersRound, Download,
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, Building2, Plus, Trash2, Shuffle, Radio,
  UploadCloud, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseDelimitedFile, extractEmails, downloadFile } from "@/lib/csv";
import { useAuthStore } from "@/store/auth.store";
import { useUsers } from "@/hooks/identity/use-users";
import { useTeams } from "@/hooks/identity/use-teams";
import {
  usePropertyFinderPreview, useEnsurePropertyFinderRoles,
  useProvisionPropertyFinderAgents, useEnsurePropertyFinderTeam,
  useImportPropertyFinderLeads, useCreateStandaloneUser,
  usePropertyFinderIntegration, usePropertyFinderSyncStatus, useSubscribePropertyFinderSync,
  type ProvisionOutcome,
} from "@/hooks/crm/use-property-finder";
import { balanceAgentsAcrossTeams } from "@/lib/crm/property-finder.api";
import type { PfAgentDto, PfAgentAssignment, PfLeadImportResultDto } from "@/lib/crm/property-finder.api";

/**
 * One team to create, and who leads it.
 *
 * A lead is either an imported Property Finder agent or somebody who does not exist there at all
 * (hired since, or never used the portal). Both are common, so both are first-class rather than
 * one being a workaround for the other.
 */
interface TeamSpec {
  key: string;
  name: string;
  /** Where the lead comes from: an imported PF agent, an existing Vrodux login, or a new person. */
  leadKind: "agent" | "existing" | "new";
  leadProfileId: number | null;   // leadKind === "agent"
  existingUserId: string | null;  // leadKind === "existing"
  leadName: string;               // leadKind === "new"
  leadEmail: string;              // leadKind === "new"
  createdTeamId: string | null;
  createdLeadUserId: string | null;
  /** Already existed in this workspace — shown for context, never re-created. */
  preExisting?: boolean;
  /** Members it already had, so the row does not read "0 agents" for a team full of people. */
  existingMembers?: number;
  existingLeadName?: string | null;
}

const newTeam = (name: string): TeamSpec => ({
  key: crypto.randomUUID(), name,
  leadKind: "agent", leadProfileId: null, existingUserId: null, leadName: "", leadEmail: "",
  createdTeamId: null, createdLeadUserId: null,
});

// ── Small building blocks ─────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>{children}</div>;
}

function Stat({ label, value, hint, tone }: {
  label: string; value: React.ReactNode; hint?: string; tone?: "warn" | "good";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={cn("text-2xl font-bold leading-tight",
        tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-foreground")}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

function StepHeader({ n, title, done, children }: {
  n: number; title: string; done?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
        done ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary")}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <h2 className="font-semibold text-foreground">{title}</h2>
      <div className="ms-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold",
      tone === "good" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : tone === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : tone === "bad" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-muted text-muted-foreground")}>
      {children}
    </span>
  );
}

const STEP_TITLES = ["Roles", "Structure", "Agents", "Import", "Live sync"] as const;

/**
 * Where you are in the run, and what is still ahead.
 *
 * A step you have completed stays clickable so you can go back and change something; one you have
 * not reached does not, because every step depends on the output of the one before it — opening
 * Import before the logins exist is the mistake this makes impossible rather than merely awkward.
 */
function Stepper({ steps, current, furthest, onGo }: {
  steps: readonly string[]; current: number; furthest: number; onGo: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((label, i) => {
        const done      = i < furthest;
        const reachable = i <= furthest;
        return (
          <React.Fragment key={label}>
            {i > 0 && <div className={cn("h-px flex-1 min-w-4", done ? "bg-emerald-400" : "bg-border")} />}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors",
                i === current ? "bg-primary/10 text-primary font-semibold"
                : reachable   ? "text-foreground hover:bg-muted/50"
                              : "text-muted-foreground/50 cursor-not-allowed")}>
              <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                done          ? "bg-emerald-500 text-white"
                : i === current ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground")}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PropertyFinderImportView() {
  const tenantName = useAuthStore(s => s.tenant?.name) ?? "this workspace";

  const [started, setStarted] = React.useState(false);
  const [step, setStep] = React.useState(0);
  // How far the run has actually got, so a completed step stays clickable but a future one does
  // not — jumping ahead to "Import" before the logins exist is the mistake this prevents.
  const [furthest, setFurthest] = React.useState(0);
  const preview = usePropertyFinderPreview(started);

  // Which agents get a login. Defaults to everyone who owns leads — importing users who own
  // nothing adds accounts to manage and nothing to the CRM.
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [seeded, setSeeded] = React.useState(false);

  // Defaults OFF. This creates logins in bulk, and every invite is a real email to a real person —
  // dozens at once, from whatever environment this happens to run in. Opting IN to that should be
  // a decision made on purpose, not discovered afterwards.
  const [sendInvite, setSendInvite] = React.useState(false);
  // Picking 42 people out of 96 by hand is how the wrong person ends up with someone else's book.
  const [pasting, setPasting]   = React.useState(false);
  const [pasted, setPasted]     = React.useState("");
  const [unmatched, setUnmatched] = React.useState<string[]>([]);

  const [managerName,  setManagerName]  = React.useState("");
  const [managerEmail, setManagerEmail] = React.useState("");
  const [managerId,    setManagerId]    = React.useState<string | null>(null);
  /** "existing" reuses a login that is already the CRM Manager; "new" creates one. */
  const [managerKind,  setManagerKind]  = React.useState<"existing" | "new">("existing");

  const [teams, setTeams] = React.useState<TeamSpec[]>([]);
  /** pfUserId → index into `teams`. The point of this screen: it is editable. */
  const [agentTeam, setAgentTeam] = React.useState<Record<number, number>>({});

  const ensureRoles  = useEnsurePropertyFinderRoles();
  const provision    = useProvisionPropertyFinderAgents();
  const ensureTeam   = useEnsurePropertyFinderTeam();
  const createPerson = useCreateStandaloneUser();
  const importLeads  = useImportPropertyFinderLeads();
  const pfIntegration = usePropertyFinderIntegration();
  const syncStatus    = usePropertyFinderSyncStatus(pfIntegration.data?.id);
  const subscribeSync = useSubscribePropertyFinderSync();
  // Existing logins — production workspaces already have a CRM Manager and team leads, so those
  // people should be reused rather than recreated under a slightly different name.
  const existingUsers = useUsers({ pageSize: 200 });
  // Production already has teams. Showing them means agents can be added to the real structure
  // instead of a parallel set of near-identical teams being created beside it.
  const existingTeams = useTeams();

  const [roleIds,  setRoleIds]  = React.useState<Record<string, string> | null>(null);
  const [crmManagerRoleId, setCrmManagerRoleId] = React.useState<string | null>(null);
  const [outcomes, setOutcomes] = React.useState<ProvisionOutcome[] | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number; current: string } | null>(null);
  const [dryRun,   setDryRun]   = React.useState<PfLeadImportResultDto | null>(null);
  const [imported, setImported] = React.useState<PfLeadImportResultDto | null>(null);
  const [importProgress, setImportProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [resumeAt, setResumeAt] = React.useState<number | null>(null);

  const agents = preview.data?.agents ?? [];
  const chosen = React.useMemo(() => agents.filter(a => selected.has(a.pfUserId)), [agents, selected]);

  React.useEffect(() => {
    if (seeded || !preview.data || !existingTeams.isFetched) return;
    setSelected(new Set(preview.data.agents.filter(a => a.leadCount > 0).map(a => a.pfUserId)));

    // Start from the teams the workspace already has, so agents join those rather than a second
    // set appearing alongside them. Only when there are none does the wizard offer a blank one.
    const current = (existingTeams.data ?? []).filter(t => t.isActive);
    setTeams(current.length > 0
      ? current.map(t => ({
          ...newTeam(t.name),
          leadKind: "existing" as const,
          existingUserId:    t.teamLeadUserId,
          createdTeamId:     t.id,
          createdLeadUserId: t.teamLeadUserId,
          preExisting:       true,
          existingMembers:   t.members?.length ?? 0,
          existingLeadName:  t.teamLeadName,
        }))
      : [newTeam("Team 1")]);
    setSeeded(true);
  }, [preview.data, existingTeams.isFetched, existingTeams.data, seeded]);

  const leadProfileIds = React.useMemo(
    () => new Set(teams.filter(t => t.leadKind === "agent" && t.leadProfileId !== null)
                       .map(t => t.leadProfileId!)),
    [teams]);

  /** Agents in each team, derived from the (editable) assignment map. */
  const buckets = React.useMemo(() => {
    const b: PfAgentDto[][] = teams.map(() => []);
    for (const a of chosen) {
      const i = agentTeam[a.pfUserId];
      if (i !== undefined && i >= 0 && i < teams.length) b[i].push(a);
    }
    return b;
  }, [chosen, agentTeam, teams]);

  const unassignedCount = chosen.filter(a => {
    const i = agentTeam[a.pfUserId];
    return i === undefined || i < 0 || i >= teams.length;
  }).length;

  /**
   * Fills the assignment map from the balancer — a starting point, not a decision. Every agent can
   * still be moved afterwards, and a team lead is pinned to their own team.
   */
  const autoBalance = () => {
    if (teams.length === 0 || chosen.length === 0) return;
    const pinned: PfAgentDto[][] = teams.map(t =>
      t.leadKind === "agent" && t.leadProfileId !== null
        ? chosen.filter(a => a.publicProfileId === t.leadProfileId)
        : []);
    const rest = chosen.filter(a => a.publicProfileId === null || !leadProfileIds.has(a.publicProfileId));
    const result = balanceAgentsAcrossTeams(rest, teams.length, pinned);

    const map: Record<number, number> = {};
    result.forEach((bucket, i) => bucket.forEach(a => { map[a.pfUserId] = i; }));
    setAgentTeam(map);
    toast.success(`Spread ${chosen.length} agents across ${teams.length} team${teams.length === 1 ? "" : "s"}.`);
  };

  /**
   * Selects agents from a pasted list of emails — a CSV column, a spreadsheet, whatever.
   *
   * Matching is on EMAIL only. Display names in Property Finder are unreliable: five different
   * people share the name "Zaheer Allam", and at least one account's name refers to somebody other
   * than the address it belongs to. Anything that does not match is reported rather than dropped,
   * because a silently-ignored line means an agent quietly loses their leads.
   */
  /** Applies a set of email addresses to the selection, reporting anything that matched nobody. */
  const applyEmails = (wanted: Set<string>, sourceLabel: string) => {
    if (wanted.size === 0) { toast.error(`No email addresses found in ${sourceLabel}.`); return; }

    const byEmail = new Map(agents.filter(a => a.email).map(a => [a.email!.trim().toLowerCase(), a]));
    const picked = new Set<number>();
    const misses: string[] = [];
    for (const e of wanted) {
      const hit = byEmail.get(e);
      if (hit) picked.add(hit.pfUserId); else misses.push(e);
    }

    setSelected(picked);
    setUnmatched(misses);
    setPasting(false);
    toast.success(`Selected ${picked.size} agent${picked.size === 1 ? "" : "s"}` +
      (misses.length ? ` — ${misses.length} address(es) matched nobody.` : "."));
  };

  const selectByEmail = () => applyEmails(
    new Set(pasted.split(/[s,;]+/)
      .map(x => x.trim().toLowerCase().replace(/^[<"‘’]+|[>"‘’]+$/g, ""))
      .filter(x => x.includes("@"))),
    "the pasted list");

  /** Filter the import to the agents listed in a CSV or Excel file. */
  const selectFromFile = async (file: File) => {
    try {
      const rows = await parseDelimitedFile(file);
      // Emails are found by looking for an "@" in any cell, so neither the column order nor the
      // header wording matters — one agency's export is not the next agency's export.
      applyEmails(new Set(extractEmails(rows)), file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const downloadSample = () => downloadFile(
    "property-finder-agents-sample.csv",
    ["Name,Email,Number",
     "Ejaz Ahmed,ejaz.example@leadingproperties.ae,971521989317",
     "Maria Noreen,maria.example@leadingproperties.ae,971545645074",
     "Zaheer Allam,zaheer.example@leadingproperties.ae,971559137418"].join("\r\n"));


  // profileId → the Vrodux user who owns that agent's leads, plus the team they are in.
  const assignments: PfAgentAssignment[] = React.useMemo(() => {
    if (!outcomes) return [];
    return outcomes
      .filter(o => o.userId && o.agent.publicProfileId !== null)
      .map(o => {
        const i = agentTeam[o.agent.pfUserId];
        return {
          publicProfileId: o.agent.publicProfileId!,
          userId:   o.userId!,
          userName: o.userName,
          teamId:   (i !== undefined ? teams[i]?.createdTeamId : null) ?? null,
        };
      });
  }, [outcomes, agentTeam, teams]);

  /**
   * Owner for leads whose agent is not being imported — the CRM Manager by default.
   *
   * Those agents are deliberately not given logins, so their leads need a person to land on rather
   * than a pile nobody works: the CRM Manager triages them and reassigns each to the right team
   * member, which sets the new owner AND their team, at which point the team lead sees it too.
   *
   * Leaving them unassigned instead is still offered. It is the tidier option for reporting — the
   * CRM Manager would not carry thousands of leads in her own per-owner figures — but it gives her
   * no queue to work from.
   */
  const [fallbackUserId, setFallbackUserId] = React.useState<string>("");
  React.useEffect(() => {
    if (!fallbackUserId && managerId) setFallbackUserId(managerId);
  }, [managerId, fallbackUserId]);

  const peopleOptions = React.useMemo(() => {
    const list: { id: string; name: string }[] = [];
    if (managerId && managerName.trim()) list.push({ id: managerId, name: `${managerName.trim()} (CRM Manager)` });
    // Same reason as the team-lead picker: duplicated display names make the email the only
    // reliable way to pick the right person.
    for (const o of outcomes ?? [])
      if (o.userId)
        list.push({ id: o.userId, name: o.agent.email ? `${o.userName} · ${o.agent.email}` : o.userName });
    return list.filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i);
  }, [managerId, managerName, outcomes]);

  const fallbackName = peopleOptions.find(o => o.id === fallbackUserId)?.name ?? null;
  const teamsCreated = teams.length > 0 && teams.every(t => t.createdTeamId);

  /**
   * Leads that will go to the fallback owner: everything not held by a selected agent.
   *
   * Two groups end up here and both matter — agents deliberately left out of the import, and
   * agents who no longer exist in Property Finder at all. Only counting the second would badly
   * understate it: filtering to 42 of 96 agents moves thousands of leads, not hundreds.
   */
  const leadsToFallback = Math.max(0,
    (preview.data?.totalLeads ?? 0) - chosen.reduce((n, a) => n + a.leadCount, 0));

  /** What has to happen before this step can be left. Null when the step is complete. */
  const stepBlocker =
    step === 0 && !roleIds  ? "Create the CRM roles to continue."
  // Teams are deliberately NOT required. Ownership is what the import cannot redo later — re-running
  // skips leads that already exist, so it never revisits them — whereas team filing can be done at
  // any time from the Leads page. Forcing the structure up front would only push people into
  // inventing one.
  : step === 2 && !outcomes ? "Create the agent logins to continue — lead ownership is built from them."
  : null;

  /** Allowed, but worth knowing before you commit to it. */
  const stepWarning =
    step === 1 && !teamsCreated
      ? "No teams yet. Every agent will still see their own leads, but team leads will see nothing until the leads are filed to a team — you can do that later from the Leads page."
      : null;

  // Never allow a step to be marked reached before its prerequisite is done.
  React.useEffect(() => {
    if (!stepBlocker) setFurthest(f => Math.max(f, step + 1));
  }, [stepBlocker, step]);

  /** Why the teams cannot be created yet — null when they can. */
  const blockedReason =
    !roleIds ? "Create the CRM roles first (step 1) — a new team lead is given the CRM Team Lead role."
  // A Property Finder agent chosen as lead gets their login created here, so the only thing that
  // can still stop us is an agent with no email address — there is nothing to create an account on.
  : teams.some(t => t.leadKind === "agent" && t.leadProfileId !== null &&
                    !agents.find(a => a.publicProfileId === t.leadProfileId)?.email)
      ? "A team lead chosen from Property Finder has no email address there, so no login can be created for them. Pick someone else, or add an existing Vrodux user as the lead."
  : teams.some(t => t.leadKind === "new" && (!t.leadName.trim() || !t.leadEmail.trim()))
              ? "Every new team lead needs a full name and an email."
  : teams.some(t => t.leadKind === "existing" && !t.existingUserId)
              ? "Pick the Vrodux user who leads each team."
  : teams.some(t => t.leadKind === "agent" && t.leadProfileId === null)
              ? "Pick the Property Finder agent who leads each team."
  : null;

  // ── Actions ────────────────────────────────────────────────────────────────

  const patchTeam = (i: number, patch: Partial<TeamSpec>) =>
    setTeams(prev => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const addTeam = () => setTeams(prev => [...prev, newTeam(`Team ${prev.length + 1}`)]);

  const removeTeam = (i: number) => {
    setTeams(prev => prev.filter((_, j) => j !== i));
    // Re-point everyone: indices shift when a team is removed, so leaving the map alone would
    // silently move agents into the wrong team rather than out of the deleted one.
    setAgentTeam(prev => {
      const next: Record<number, number> = {};
      for (const [id, idx] of Object.entries(prev)) {
        if (idx === i) continue;
        next[Number(id)] = idx > i ? idx - 1 : idx;
      }
      return next;
    });
  };

  const runRoles = async () => {
    const r = await ensureRoles.mutateAsync();
    setRoleIds(r.roleIdByName);
    setCrmManagerRoleId(r.crmManagerRoleId);
    if (r.missingPermissions.length)
      toast.warning(`Not seeded in this deployment: ${r.missingPermissions.join(", ")}`);
    if (!r.crmManagerRoleId)
      toast.warning("No 'CRM Manager' role in this workspace — a manager would be created without one.");
    toast.success(r.created.length
      ? `Created ${r.created.join(" and ")}.`
      : "Roles already existed — permissions re-applied.");
  };

  const runProvision = async () => {
    if (!roleIds) return;
    setProgress({ done: 0, total: chosen.length, current: "" });
    const res = await provision.mutateAsync({
      agents: chosen, roleIdByName: roleIds, sendInvite,
      onProgress: (done, total, current) => setProgress({ done, total, current }),
    });
    setProgress(null);
    setOutcomes(res);
    const created = res.filter(r => r.status === "created").length;
    const linked  = res.filter(r => r.status === "linked").length;
    const failed  = res.filter(r => r.status === "failed" || r.status === "skipped").length;
    toast.success(`${created} created, ${linked} linked${failed ? `, ${failed} skipped` : ""}.`);

    // The teams were built first and are still empty, so put everyone in now. This also settles
    // any team whose lead is a Property Finder agent, which could not be resolved until the agent
    // had a login.
    if (teams.some(t => t.createdTeamId)) {
      try { await runPeopleAndTeams(res); }
      catch { toast.error("Logins were created, but adding them to their teams failed — press “Apply to teams”."); }
    }
  };

  /**
   * Creates the manager, any team lead who is not a Property Finder agent, then the teams.
   * Order matters — a team needs its lead's user id. Every step is idempotent, so a partial
   * failure can simply be re-run.
   */
  /**
   * @param known The provisioning results to build membership from. Passed in rather than read
   *   from state because this runs immediately after provisioning, when the state update has not
   *   landed yet — reading `outcomes` there would silently build every team empty.
   */
  const runPeopleAndTeams = async (known: ProvisionOutcome[] | null = outcomes) => {
    if (!roleIds) return;

    if (managerKind === "new" && !managerId && managerEmail.trim() && managerName.trim()) {
      const r = await createPerson.mutateAsync({
        fullName: managerName, email: managerEmail,
        roleId: crmManagerRoleId ?? undefined, sendInvite,
      });
      setManagerId(r.userId);
      if (r.temporaryPassword) toast.info(`${managerName}: ${r.temporaryPassword}`, { duration: 60000 });
    }

    const userIdForAgent = (profileId: number | null) =>
      profileId === null ? null
        : (known ?? []).find(o => o.agent.publicProfileId === profileId)?.userId ?? null;

    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];

      let leadUserId = t.createdLeadUserId;
      if (!leadUserId) {
        if (t.leadKind === "agent") {
          leadUserId = userIdForAgent(t.leadProfileId);

          // The agent has no login yet — this step runs before the bulk provisioning, so create
          // theirs now rather than blocking the whole structure on it. Provisioning later finds
          // them by email and links, so they never end up with two accounts, and because they are
          // created with the team-lead role that stays theirs.
          if (!leadUserId) {
            const agent = agents.find(x => x.publicProfileId === t.leadProfileId);
            if (agent?.email) {
              const r = await createPerson.mutateAsync({
                fullName: agent.fullName, email: agent.email,
                roleId: roleIds["CRM Team Lead"], sendInvite,
              });
              leadUserId = r.userId;
              if (r.temporaryPassword) toast.info(`${agent.fullName}: ${r.temporaryPassword}`, { duration: 60000 });
            }
          }
        } else if (t.leadKind === "existing") {
          // Already a login in this workspace — nothing to create.
          leadUserId = t.existingUserId;
        } else if (t.leadName.trim() && t.leadEmail.trim()) {
          const r = await createPerson.mutateAsync({
            fullName: t.leadName, email: t.leadEmail,
            roleId: roleIds["CRM Team Lead"], sendInvite,
          });
          leadUserId = r.userId;
          if (r.temporaryPassword) toast.info(`${t.leadName}: ${r.temporaryPassword}`, { duration: 60000 });
        }
      }

      // Empty on the first pass, when the teams are created before anybody is provisioned. The
      // second pass — straight after the logins exist — fills them in; ensureTeam only ever ADDS
      // members, so running it twice is safe and never drops anyone.
      const memberIds = buckets[i]
        .map(a => (known ?? []).find(o => o.agent.pfUserId === a.pfUserId)?.userId)
        .filter((x): x is string => !!x);
      // The lead belongs to their own team — otherwise they own leads in a team they are not in,
      // which reads as a data error in the team reports.
      if (leadUserId && !memberIds.includes(leadUserId)) memberIds.push(leadUserId);

      const team = await ensureTeam.mutateAsync({
        name: t.name.trim() || `Team ${i + 1}`, leadUserId, memberUserIds: memberIds,
      });
      patchTeam(i, { createdTeamId: team.id, createdLeadUserId: leadUserId });
    }
    toast.success(`${teams.length} team${teams.length === 1 ? "" : "s"} ready.`);
  };

  /**
   * Runs the import in slices, resuming from where it stopped.
   *
   * The whole thing used to be one request: navigating away aborted the fetch, the server saw the
   * client disconnect and cancelled mid-way, and the import simply stopped — with no way to tell
   * how far it had reached. Batches make an interruption cost one slice instead of everything, and
   * keep each request short enough that no proxy or browser timeout can reach it.
   */
  const runImport = async (isDryRun: boolean, startAt = 0) => {
    const BATCH = 200;
    let skip = startAt;
    const totals = { leadsFetched: 0, peopleImported: 0, created: 0, duplicates: 0,
                     failed: 0, enquiriesLogged: 0, unassigned: 0 };
    const errors: string[] = [];

    setImportError(null);
    try {
      for (;;) {
        const res = await importLeads.mutateAsync({
          assignments,
          fallbackUserId:   fallbackUserId || null,
          fallbackUserName: fallbackName,
          // No import-wide team: every assignment carries the team of its own owner.
          teamId: null,
          dryRun: isDryRun,
          skip, take: BATCH,
        });

        totals.leadsFetched    = res.leadsFetched;
        totals.peopleImported += res.peopleImported;
        totals.created        += res.created;
        totals.duplicates     += res.duplicates;
        totals.failed         += res.failed;
        totals.enquiriesLogged += res.enquiriesLogged;
        totals.unassigned     += res.unassigned;
        errors.push(...res.errors);

        skip = res.nextSkip;
        setImportProgress({ done: skip, total: res.totalPeople });

        // Report as we go, so an interruption still leaves visible numbers rather than nothing.
        const running = { ...totals, errors: errors.slice(0, 50),
                          totalPeople: res.totalPeople, nextSkip: skip, hasMore: res.hasMore };
        if (isDryRun) setDryRun(running); else setImported(running);

        if (!res.hasMore) break;
      }

      setImportProgress(null);
      if (isDryRun) toast.info(`Dry run: ${totals.created} leads would be created from ${totals.leadsFetched} enquiries.`);
      else toast.success(`Imported ${totals.created} leads (${totals.duplicates} already present).`);
    } catch (e) {
      // Keep the cursor so the run can be picked up rather than restarted.
      setResumeAt(skip);
      setImportError(e instanceof Error ? e.message : String(e));
      setImportProgress(null);
    }
  };
  // ── Render ─────────────────────────────────────────────────────────────────

  // Credentials are per-tenant, so an unconnected workspace cannot even preview. Asking for the
  // key up front is clearer than letting every call fail with "not configured".
  const needsKey = pfIntegration.isFetched && !pfIntegration.data;

  if (needsKey) {
    return (
      <div className="max-w-3xl space-y-6">
        <Header tenantName={tenantName} />
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm text-foreground">
            This workspace has no Property Finder integration yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect it under <b>Settings → Integrations → Property Finder</b> and enter the agency’s
            API key there. The key is stored against that integration, so each workspace uses its own.
          </p>
        </Card>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-3xl space-y-6">
        <Header tenantName={tenantName} />
        <Card>
          <p className="text-sm text-muted-foreground">
            This reads the connected Property Finder account — its users, roles and full lead
            history — and shows exactly what would be created before anything is written. Nothing
            is imported until you say so.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setStarted(true)}>
            <RefreshCw className="h-4 w-4" /> Connect and review
          </Button>
        </Card>
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Header tenantName={tenantName} />
        <Card className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the Property Finder account — this walks every page of users and leads, so it can
          take a few seconds.
        </Card>
      </div>
    );
  }

  if (preview.isError) {
    return (
      <div className="max-w-3xl space-y-6">
        <Header tenantName={tenantName} />
        <Card className="border-destructive/40">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Could not read the Property Finder account</p>
              <p className="text-sm text-muted-foreground mt-1">{(preview.error as Error)?.message}</p>
              {/* Only for an actual scope failure — showing it for every error sends people to
                  regenerate a key over something unrelated. */}
              {/scope|forbidden/i.test((preview.error as Error)?.message ?? "") && (
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  An API key’s scopes are fixed when it is created, so this cannot be fixed by
                  retrying — a new key would be needed.
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => preview.refetch()}>Try again</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const p = preview.data!;

  return (
    <div className="max-w-5xl space-y-6">
      <Header tenantName={tenantName} />

      <Stepper steps={STEP_TITLES} current={step} furthest={furthest} onGo={setStep} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Property Finder users" value={p.totalPfUsers} hint={`${p.activePfUsers} active`} />
        <Stat label="Agents owning leads" value={p.agentsOwningLeads} hint="the ones worth a login" />
        <Stat label="Enquiries" value={p.totalLeads.toLocaleString()}
              hint={p.oldestLeadAt ? `since ${p.oldestLeadAt.slice(0, 10)}` : undefined} />
        <Stat label="Distinct people" value={p.distinctPeople.toLocaleString()} tone="good"
              hint={`${p.repeatEnquiries.toLocaleString()} repeat enquiries merged`} />
      </div>

      {p.leadsWithUnknownAgent > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            {/* The figure shown is the LIVE one: as soon as agents are deselected it is no longer
                just the departed ones, and quoting the smaller number would understate by
                thousands. */}
            <p className="text-xs text-foreground">
              <b>{leadsToFallback.toLocaleString()} enquiries</b> have no imported agent
              {leadsToFallback > p.leadsWithUnknownAgent && (
                <> — {p.leadsWithUnknownAgent.toLocaleString()} from agents who no longer exist in
                   Property Finder, the rest from agents you have not selected</>
              )}
              . They go to the fallback owner chosen on the Import step — otherwise they would be
              visible to nobody.
            </p>
          </div>
        </Card>
      )}

      {step === 0 && (
        <Card>
          <StepHeader n={1} title="Create the CRM roles" done={!!roleIds}>
            <Button size="sm" className="gap-2" disabled={ensureRoles.isPending} onClick={runRoles}>
              {ensureRoles.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {roleIds ? "Re-apply" : "Create roles"}
            </Button>
          </StepHeader>
          <p className="text-xs text-muted-foreground">
            <b>PF Agent</b> sees only the leads assigned to them; <b>CRM Team Lead</b> sees every lead
            owned by their team. The workspace's existing <b>CRM Manager</b> role is reused as-is for
            the manager — a second role by the same name would be indistinguishable in the list.
          </p>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <StepHeader n={2} title="Structure — manager, team leads and teams" done={teamsCreated}>
            <Button size="sm" variant="outline" className="gap-2 h-8" onClick={autoBalance}
              disabled={teams.length === 0 || chosen.length === 0}>
              <Shuffle className="h-3.5 w-3.5" /> Auto-balance
            </Button>
            <Button size="sm" variant="outline" className="gap-2 h-8" onClick={addTeam}>
              <Plus className="h-3.5 w-3.5" /> Add team
            </Button>
          </StepHeader>

          <p className="text-xs text-muted-foreground mb-4">
            A team has one lead, and that lead sees every lead owned by the team's members — so this
            structure decides who can see what. Set it up however the business actually runs.
            <b> Auto-balance</b> is only a starting point: it spreads agents so each team carries a
            similar share of the lead volume, and you can move anyone by hand in the next step.
          </p>

          <div className="space-y-3">
            {teams.map((t, i) => (
              <TeamRow key={t.key} spec={t} index={i} agents={agents}
                vroduxUsers={existingUsers.data?.items ?? []}
                takenProfileIds={leadProfileIds}
                memberCount={buckets[i]?.length ?? 0}
                leadVolume={(buckets[i] ?? []).reduce((n, x) => n + x.leadCount, 0)}
                onPatch={patch => patchTeam(i, patch)}
                // Removing here would only drop it from the wizard, not from the workspace —
              // an ambiguity not worth offering for a team that already exists.
              onRemove={!t.preExisting && teams.length > 1 ? () => removeTeam(i) : undefined} />
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  CRM Manager — sees every lead (optional)
                </p>
                {managerId && <Badge tone="good">set</Badge>}
              </div>
              <select value={managerKind} disabled={!!managerId}
                className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs"
                onChange={e => setManagerKind(e.target.value as "existing" | "new")}>
                <option value="existing">Use an existing Vrodux user</option>
                <option value="new">Create a new login</option>
              </select>
              {managerKind === "existing" ? (
                <select value={managerId ?? ""}
                  className="w-full h-8 px-2 rounded-lg border border-border bg-card text-xs"
                  onChange={e => {
                    const u = (existingUsers.data?.items ?? []).find(x => x.id === e.target.value);
                    setManagerId(e.target.value || null);
                    setManagerName(u?.fullName ?? "");
                  }}>
                  <option value="">— nobody —</option>
                  {(existingUsers.data?.items ?? []).map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} — {u.email}</option>
                  ))}
                </select>
              ) : (
                <>
                  <Input value={managerName} onChange={e => setManagerName(e.target.value)}
                    placeholder="Full name" className="h-8 text-xs" disabled={!!managerId} />
                  <Input value={managerEmail} onChange={e => setManagerEmail(e.target.value)} type="email"
                    placeholder="email@company.com" className="h-8 text-xs" disabled={!!managerId} />
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Choosing an existing user only nominates them as the fallback owner — it does not
                change their roles.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Apply the structure
              </p>
              <Button size="sm" className="gap-2 w-full"
                disabled={!!blockedReason || createPerson.isPending || ensureTeam.isPending}
                onClick={() => runPeopleAndTeams()}>
                {(createPerson.isPending || ensureTeam.isPending)
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <UsersRound className="h-3.5 w-3.5" />}
                {teamsCreated ? "Update teams" : "Create people and teams"}
              </Button>
              {/* A disabled button with no explanation is the thing people get stuck on. */}
              <p className={cn("mt-2 text-[11px]", blockedReason ? "text-amber-600" : "text-muted-foreground")}>
                {blockedReason ?? "Creates the manager, any new team leads, and the teams with their members."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <StepHeader n={3} title="Agents — who gets a login, and in which team" done={!!outcomes}>
            <span className="text-xs text-muted-foreground">{chosen.length} selected</span>
            <Button variant="outline" size="sm"
              onClick={() => setSelected(new Set(agents.filter(a => a.leadCount > 0).map(a => a.pfUserId)))}>
              Owners of leads
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>None</Button>
            <Button variant="outline" size="sm" onClick={() => setPasting(v => !v)}>Paste list</Button>
            <Button size="sm" className="gap-2"
              disabled={!roleIds || chosen.length === 0 || provision.isPending}
              onClick={runProvision}>
              {provision.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              Create {chosen.length} logins
            </Button>
          </StepHeader>

          {pasting && (
            <div className="mb-3 rounded-lg border border-border p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Choose which agents get a login: paste their email addresses, or upload a CSV /
                Excel list. Everyone else stays unselected, and their leads go to the fallback owner
                you pick in the last step. Matching is on <b>email</b> — Property Finder display names
                repeat across different people, so a name identifies nobody.
              </p>
              <textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={5}
                placeholder="one@example.com, two@example.com …"
                className="w-full rounded-lg border border-border bg-card p-2 text-xs font-mono" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={selectByEmail}>Select these</Button>
                <label className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border bg-card text-xs cursor-pointer hover:border-primary/50">
                  <UploadCloud className="h-3.5 w-3.5" /> Upload CSV
                  <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) selectFromFile(f); e.target.value = ""; }} />
                </label>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={downloadSample}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Sample file
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setPasting(false); setPasted(""); }}>Cancel</Button>
              </div>
            </div>
          )}

          {unmatched.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2.5">
              <p className="text-[11px] text-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-px shrink-0" />
                <span>
                  <b>{unmatched.length}</b> address(es) matched no Property Finder agent, so nobody was
                  selected for them — check for a typo before importing:
                  <span className="block font-mono mt-1">{unmatched.join(", ")}</span>
                </span>
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 text-xs mb-3">
            <input type="checkbox" className="mt-0.5" checked={sendInvite}
              onChange={e => setSendInvite(e.target.checked)} />
            <span>
              <span className="text-foreground">Email everyone a set-your-own-password link</span>
              <span className="block text-muted-foreground">
                Off by default. Turning this on sends <b>{chosen.length} real emails</b> the moment you
                press the button. Left off, each temporary password is shown here once.
              </span>
            </span>
          </label>
          {sendInvite && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2.5">
              <p className="text-[11px] text-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-px shrink-0" />
                {chosen.length} invitation emails will be sent from this environment. They cannot be recalled.
              </p>
            </div>
          )}

          {unassignedCount > 0 && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2.5">
              <p className="text-[11px] text-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-px shrink-0" />
                <b>{unassignedCount}</b> selected {unassignedCount === 1 ? "agent is" : "agents are"} in
                no team. Their leads will be visible only to themselves — no team lead will see them.
                Use <b>Auto-balance</b>, or set each one in the Team column.
              </p>
            </div>
          )}

          {progress && (
            <div className="mb-3">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div className="h-full bg-primary"
                  animate={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {progress.done} / {progress.total} — {progress.current}
              </p>
            </div>
          )}

          {outcomes && (
            <div className="flex items-center gap-3 text-xs mb-4">
              <Badge tone="good">{outcomes.filter(o => o.status === "created").length} created</Badge>
              <Badge>{outcomes.filter(o => o.status === "linked").length} linked</Badge>
              <Badge tone="warn">{outcomes.filter(o => o.status === "skipped").length} skipped</Badge>
              {outcomes.some(o => o.status === "failed") &&
                <Badge tone="bad">{outcomes.filter(o => o.status === "failed").length} failed</Badge>}
            </div>
          )}

          {outcomes?.some(o => o.detail?.startsWith("Temporary password")) && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-[11px] font-semibold text-foreground mb-1">
                Temporary passwords — shown once and never retrievable again
              </p>
              <div className="max-h-40 overflow-y-auto font-mono text-[11px] text-muted-foreground space-y-0.5">
                {outcomes.filter(o => o.detail?.startsWith("Temporary password")).map(o => (
                  <div key={o.agent.pfUserId}>{o.agent.email} — {o.detail!.replace("Temporary password: ", "")}</div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-muted-foreground">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="text-start px-3 py-2 font-semibold">Agent</th>
                  <th className="text-start px-3 py-2 font-semibold">PF role</th>
                  <th className="text-end px-3 py-2 font-semibold">Leads</th>
                  <th className="text-start px-3 py-2 font-semibold">Team</th>
                  <th className="text-start px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <AgentRow key={a.pfUserId} agent={a}
                    checked={selected.has(a.pfUserId)}
                    teams={teams}
                    teamIndex={agentTeam[a.pfUserId]}
                    outcome={outcomes?.find(o => o.agent.pfUserId === a.pfUserId)}
                    onTeam={idx => setAgentTeam(prev => {
                      const next = { ...prev };
                      if (idx === null) delete next[a.pfUserId]; else next[a.pfUserId] = idx;
                      return next;
                    })}
                    onToggle={() => setSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(a.pfUserId)) next.delete(a.pfUserId); else next.add(a.pfUserId);
                      return next;
                    })} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <StepHeader n={4} title="Import the leads" done={!!imported}>
            <Button size="sm" variant="outline" className="gap-2"
              disabled={importLeads.isPending || assignments.length === 0}
              onClick={() => runImport(true)}>
              {importLeads.isPending && dryRun === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Dry run
            </Button>
            <Button size="sm" className="gap-2"
              disabled={importLeads.isPending || assignments.length === 0 || !dryRun}
              onClick={() => runImport(false)}>
              {importLeads.isPending && dryRun !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Import
            </Button>
          </StepHeader>

          {assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Create the agent logins first — leads are assigned by matching each enquiry's agent to
              their new Vrodux user.
            </p>
          ) : (
            <>
              {!teamsCreated && (
                <p className="text-xs text-amber-600 mb-3">
                  The teams have not been created yet, so every lead would be filed to no team and be
                  invisible to the team leads. Run <b>Create people and teams</b> first.
                </p>
              )}
              <div className="flex items-end gap-2 mb-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Owner for leads with no imported agent
                  </label>
                  <select value={fallbackUserId} onChange={e => setFallbackUserId(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-border bg-card text-xs w-72">
                    <option value="">Unassigned — visible to the CRM Manager and administrators only</option>
                    {peopleOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>

              <p className="text-xs mb-4 text-muted-foreground">
                <b>{leadsToFallback.toLocaleString()}</b> of {(preview.data?.totalLeads ?? 0).toLocaleString()} leads
                belong to agents you did not import, or to agents no longer in Property Finder
                {fallbackUserId
                  ? <> — they go to <b>{fallbackName}</b> to triage and reassign. They will count
                       towards that person&rsquo;s figures in per-owner reports until reassigned.</>
                  : <> — they stay <b>unassigned</b>: the CRM Manager and administrators see them,
                       team leads and agents do not.</>}
              </p>

              {importProgress && (
                <div className="mb-3">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div className="h-full bg-primary"
                      animate={{ width: `${(importProgress.done / Math.max(1, importProgress.total)) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {importProgress.done.toLocaleString()} / {importProgress.total.toLocaleString()} people —
                    keep this page open until it finishes.
                  </p>
                </div>
              )}

              {importError && (
                <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                  <p className="text-[11px] text-destructive">{importError}</p>
                  {resumeAt !== null && (
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                      onClick={() => runImport(false, resumeAt)}>
                      Resume from {resumeAt.toLocaleString()}
                    </Button>
                  )}
                </div>
              )}

              {dryRun && !imported && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 mb-3">
                  <p className="text-xs font-semibold text-foreground mb-2">Dry run — nothing was written</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div><b>{dryRun.leadsFetched.toLocaleString()}</b> enquiries read</div>
                    <div><b>{dryRun.peopleImported.toLocaleString()}</b> people after merging</div>
                    <div className={dryRun.unassigned ? "text-amber-600" : ""}>
                      <b>{dryRun.unassigned.toLocaleString()}</b> would be unassigned
                    </div>
                  </div>
                </div>
              )}

              {imported && <ImportResult result={imported} />}
            </>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <StepHeader n={5} title="Keep it up to date automatically" done={syncStatus.data?.live === true}>
            <Button size="sm" className="gap-2"
              disabled={!pfIntegration.data || subscribeSync.isPending}
              onClick={() => pfIntegration.data && subscribeSync.mutate(pfIntegration.data.id)}>
              {subscribeSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              {syncStatus.data?.live ? "Re-check" : "Turn on live sync"}
            </Button>
          </StepHeader>

          <p className="text-xs text-muted-foreground mb-3">
            Without this, the import above is a one-off: nothing new arrives until somebody re-runs
            it. This registers your inbound URL with Property Finder so <b>lead.created</b> and
            <b> lead.assigned</b> are delivered as they happen. A background poll every 30 minutes
            catches anything missed while the server was restarting.
          </p>

          {!pfIntegration.data ? (
            <p className="text-xs text-amber-600">
              No Property Finder integration exists yet. Connect it under
              <b> Settings → Integrations</b> first — that is what creates the inbound URL Property
              Finder delivers to.
            </p>
          ) : (
            <>
              {syncStatus.data?.callbackUrl && (
                <p className="text-[11px] font-mono text-muted-foreground break-all mb-2">
                  {syncStatus.data.callbackUrl}
                </p>
              )}

              {syncStatus.data?.live && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Live — new enquiries arrive on their own.
                </p>
              )}

              {(subscribeSync.data?.blocker || syncStatus.data?.blocker) && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2.5">
                  <p className="text-[11px] text-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-px shrink-0" />
                    {subscribeSync.data?.blocker ?? syncStatus.data?.blocker}
                  </p>
                </div>
              )}

              {(subscribeSync.data?.notes ?? []).map((n, i) => (
                <p key={i} className="text-[11px] text-muted-foreground mt-1">{n}</p>
              ))}

              {(subscribeSync.data ?? syncStatus.data)?.subscriptions?.length ? (
                <div className="mt-2 space-y-1">
                  {(subscribeSync.data ?? syncStatus.data)!.subscriptions.map((w, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">
                      <b className="text-foreground">{w.eventId}</b> → {w.url}
                      {!w.isOurs && <span className="text-amber-600"> (another destination)</span>}
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Card>
      )}

      {/* Nav lives at the bottom so the eye ends on "what next" rather than on a wall of rows. */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
          Back
        </Button>
        <div className="flex-1">
          {stepBlocker
            ? <p className="text-xs text-amber-600">{stepBlocker}</p>
            : stepWarning && <p className="text-xs text-muted-foreground">{stepWarning}</p>}
        </div>
        {step < STEP_TITLES.length - 1 && (
          <Button disabled={!!stepBlocker} onClick={() => setStep(s => Math.min(STEP_TITLES.length - 1, s + 1))}>
            Next: {STEP_TITLES[step + 1]}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function Header({ tenantName }: { tenantName: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">PF</div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Property Finder Import</h1>
        <p className="text-sm text-muted-foreground">
          Bring agents and their lead history into <b>{tenantName}</b>.
        </p>
      </div>
    </div>
  );
}

/** One team: its name, who leads it, and how much work it is carrying. */
function TeamRow({ spec, index, agents, vroduxUsers, takenProfileIds, memberCount, leadVolume, onPatch, onRemove }: {
  spec: TeamSpec; index: number; agents: PfAgentDto[];
  vroduxUsers: { id: string; fullName: string; email: string }[];
  takenProfileIds: Set<number>;
  memberCount: number; leadVolume: number;
  onPatch: (patch: Partial<TeamSpec>) => void; onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Input value={spec.name} placeholder={`Team ${index + 1}`} className="h-8 text-xs max-w-xs"
          disabled={spec.preExisting} onChange={e => onPatch({ name: e.target.value })} />
        {spec.preExisting
          ? <Badge>existing</Badge>
          : spec.createdTeamId && <Badge tone="good">created</Badge>}
        <span className="ms-auto text-[11px] text-muted-foreground">
          {spec.preExisting && (
            <>{spec.existingMembers ?? 0} already in it · </>
          )}
          +{memberCount} agents · <b className="text-foreground">{leadVolume.toLocaleString()}</b> leads
        </span>
        {onRemove && (
          <button onClick={onRemove} className="p-1 rounded hover:bg-muted text-muted-foreground"
            title="Remove team">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {spec.preExisting ? (
        <p className="text-[11px] text-muted-foreground">
          Led by <b className="text-foreground">{spec.existingLeadName ?? "nobody yet"}</b>. This team
          already exists — agents selected below are added to it, and nothing about it is changed.
        </p>
      ) : (
      <div className="grid md:grid-cols-2 gap-2">
        <select value={spec.leadKind} disabled={!!spec.createdLeadUserId}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
          onChange={e => onPatch({ leadKind: e.target.value as TeamSpec["leadKind"] })}>
          <option value="agent">Lead is a Property Finder agent</option>
          <option value="existing">Lead is an existing Vrodux user</option>
          <option value="new">Lead is someone new (create a login)</option>
        </select>

        {spec.leadKind === "agent" ? (
          <select value={spec.leadProfileId ?? ""} disabled={!!spec.createdLeadUserId}
            className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
            onChange={e => onPatch({ leadProfileId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— choose a lead —</option>
            {agents
              .filter(a => a.publicProfileId !== null &&
                          (!takenProfileIds.has(a.publicProfileId) || a.publicProfileId === spec.leadProfileId))
              // The email is not decoration: several Property Finder accounts share a display
              // name — five different people in this account are all called "Zaheer Allam" — so
              // the name alone cannot identify who a team is being handed to.
              .map(a => (
                <option key={a.pfUserId} value={a.publicProfileId!}>
                  {a.fullName}{a.email ? ` · ${a.email}` : ""} — {a.leadCount.toLocaleString()} leads
                </option>
              ))}
          </select>
        ) : spec.leadKind === "existing" ? (
          <select value={spec.existingUserId ?? ""} disabled={!!spec.createdLeadUserId}
            className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
            onChange={e => onPatch({ existingUserId: e.target.value || null })}>
            <option value="">— choose a Vrodux user —</option>
            {vroduxUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.fullName} — {u.email}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input value={spec.leadName} placeholder="Full name" className="h-8 text-xs"
              disabled={!!spec.createdLeadUserId}
              onChange={e => onPatch({ leadName: e.target.value })} />
            <Input value={spec.leadEmail} placeholder="email@company.com" type="email" className="h-8 text-xs"
              disabled={!!spec.createdLeadUserId}
              onChange={e => onPatch({ leadEmail: e.target.value })} />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function AgentRow({ agent, checked, teams, teamIndex, outcome, onToggle, onTeam }: {
  agent: PfAgentDto; checked: boolean; teams: TeamSpec[]; teamIndex: number | undefined;
  outcome?: ProvisionOutcome; onToggle: () => void; onTeam: (i: number | null) => void;
}) {
  const blocked = agent.emailInUse && !outcome;
  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2">
        <p className="font-medium text-foreground">{agent.fullName || "—"}</p>
        <p className="text-[11px] text-muted-foreground">{agent.email ?? "no email"}</p>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{agent.roleName ?? "—"}</td>
      <td className="px-3 py-2 text-end tabular-nums">
        {agent.leadCount > 0
          ? <b className="text-foreground">{agent.leadCount.toLocaleString()}</b>
          : <span className="text-muted-foreground">0</span>}
      </td>
      <td className="px-3 py-2">
        {checked ? (
          <select
            value={teamIndex ?? ""}
            className={cn("h-7 px-1.5 rounded border bg-card text-[11px] w-36",
              teamIndex === undefined ? "border-amber-400 text-amber-600" : "border-border")}
            onChange={e => onTeam(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">— no team —</option>
            {teams.map((t, i) => <option key={t.key} value={i}>{t.name.trim() || `Team ${i + 1}`}</option>)}
          </select>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2">
        {outcome
          ? <Badge tone={outcome.status === "created" || outcome.status === "linked" ? "good"
                       : outcome.status === "failed" ? "bad" : "warn"}>{outcome.status}</Badge>
          : agent.status === "inactive"
            ? <Badge>inactive in PF</Badge>
            : <Badge tone="good">active</Badge>}
        {(outcome?.detail && !outcome.detail.startsWith("Temporary password")) && (
          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xs">{outcome.detail}</p>
        )}
        {blocked && agent.emailInUseNote && (
          <p className="text-[10px] text-amber-600 mt-0.5 max-w-xs">{agent.emailInUseNote}</p>
        )}
      </td>
    </tr>
  );
}

function ImportResult({ result }: { result: PfLeadImportResultDto }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-semibold text-foreground">Import complete</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div><b className="text-lg block">{result.created.toLocaleString()}</b>leads created</div>
        <div><b className="text-lg block">{result.enquiriesLogged.toLocaleString()}</b>enquiries kept as history</div>
        <div><b className="text-lg block">{result.duplicates.toLocaleString()}</b>already present</div>
        <div className={result.failed ? "text-red-600" : ""}>
          <b className="text-lg block">{result.failed.toLocaleString()}</b>failed
        </div>
      </div>
      {result.errors.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Show the first {result.errors.length} problems</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-muted-foreground max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      )}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Building2 className="h-3 w-3" /> Open CRM → Leads to see them.
        <ArrowRight className="h-3 w-3" />
      </p>
    </div>
  );
}
