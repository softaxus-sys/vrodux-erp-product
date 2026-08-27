import * as React from "react";
import { useTranslation } from "react-i18next";
import { useAssignableUsers } from "@/hooks/identity/use-teams";
import { useAuthStore } from "@/store/auth.store";

export interface AssignableOption {
  id:       string;
  /** The team this option was listed under — submitted so the record records whose work it is. */
  teamId:   string | null;
  /** Plain name — this is what gets stored on the record, not the decorated label. */
  fullName: string;
  /** Decorated for display: 👑 marks a team lead. */
  label:    string;
}

export interface AssignableTeamGroup {
  team:    string;
  members: AssignableOption[];
}

/**
 * The people the caller may assign work to, grouped by team for an `<optgroup>` picker.
 *
 * <p>The pool itself is decided server-side by the caller's tier — an admin gets everyone, a team
 * lead only their own members — so this hook never filters, it only arranges.</p>
 *
 * <p><b>Team membership is many-to-many.</b> Someone in two teams is listed under <i>both</i>, on
 * purpose: dropping them from one would make that team look smaller than it is. Callers rendering
 * these groups must key options by team + user, since a user id alone is not unique across groups.
 * People in no team fall into a trailing "No team" group rather than being omitted.</p>
 *
 * Shared by the reassign dialog and the create/edit lead form so the two pickers can't drift apart.
 */
/**
 * Everyone this caller may assign CRM work to, grouped by team.
 *
 * Scoped to the CRM module: a colleague with no CRM access cannot open a lead, so offering them in
 * the picker only produces records their assignee cannot see.
 */
export function useAssignableByTeam(enabled = true, module = "crm") {
  const { t } = useTranslation("crm");
  const query = useAssignableUsers(enabled, module);
  const assignable = query.data ?? [];

  const options = React.useMemo<AssignableOption[]>(
    () => assignable.map(u => ({
      id: u.userId,
      teamId: null,
      fullName: u.fullName,
      label: u.isLead ? `👑 ${u.fullName}` : `👤 ${u.fullName}`,
    })),
    [assignable],
  );

  const groups = React.useMemo<AssignableTeamGroup[]>(() => {
    const byTeam = new Map<string, AssignableOption[]>();
    const noTeam: AssignableOption[] = [];

    const label = (u: (typeof assignable)[number]) =>
      u.isLead ? `👑 ${u.fullName}` : `👤 ${u.fullName}`;

    for (const u of assignable) {
      const teams = u.teams ?? [];
      if (teams.length === 0) {
        noTeam.push({ id: u.userId, teamId: null, fullName: u.fullName, label: label(u) });
        continue;
      }
      // One entry PER TEAM, each carrying that team id — picking the person under "Warsan" files
      // the record to Warsan, which is what makes a multi-team owner unambiguous.
      for (const team of teams) {
        const list = byTeam.get(team.name) ?? [];
        list.push({ id: u.userId, teamId: team.teamId, fullName: u.fullName, label: label(u) });
        byTeam.set(team.name, list);
      }
    }

    const named = [...byTeam.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([team, members]) => ({ team, members }));

    return noTeam.length > 0
      ? [...named, { team: t("drawer.noTeam"), members: noTeam }]
      : named;
  }, [assignable, t]);

  /** Flat list — for resolving a selected id back to its name. */
  return { groups, options, isLoading: query.isLoading };
}

/**
 * A `<select>` cannot hold two values, but an assignment needs both the person and the team they
 * were picked under. These encode/decode that pair into a single option value.
 *
 * "" means unassigned. A user with no team encodes as `userId::` (empty team half).
 */
export function encodeAssignee(userId: string, teamId: string | null): string {
  return `${userId}::${teamId ?? ""}`;
}

export function decodeAssignee(value: string): { userId: string | null; teamId: string | null } {
  if (!value) return { userId: null, teamId: null };
  const [userId, teamId] = value.split("::");
  return { userId: userId || null, teamId: teamId || null };
}

/**
 * Distinct teams the caller can file records to, derived from the same assignable pool.
 *
 * Derived rather than fetched from `/api/teams` on purpose: that endpoint requires
 * `settings.users.view`, which a team lead does not have — but `assignable-users` is open to them
 * and already carries their teams. So a team lead can file to the teams they lead, and an admin to
 * every team that has a member.
 */
export function useTeamsForFiling(enabled = true, module = "crm") {
  const query = useAssignableUsers(enabled, module);
  const assignable = query.data ?? [];

  const teams = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of assignable) {
      for (const t of u.teams ?? []) map.set(t.teamId, t.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignable]);

  /**
   * Who is in each team, from the same server-scoped pool as the team list — so a team lead only
   * ever sees people they are allowed to assign to, and no extra permission is needed.
   */
  const membersByTeam = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const u of assignable) {
      for (const t of u.teams ?? []) {
        const list = map.get(t.teamId) ?? [];
        list.push({ id: u.userId, name: u.fullName });
        map.set(t.teamId, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [assignable]);

  return { teams, membersByTeam, isLoading: query.isLoading };
}

/**
 * The option a create form should start on: the current user, under their team when that is
 * unambiguous.
 *
 * <p>Why this matters: an unfiled record is invisible to every team lead, and the server only
 * auto-files when the creator belongs to exactly one team. Someone in several teams would otherwise
 * produce unfiled records forever — so the form pre-selects them with a team when it can, and
 * returns `needsTeamChoice` when it cannot, so the UI can ask instead of guessing. Guessing is the
 * one thing we must not do: filing to the wrong team shows the record to a lead who should not
 * see it and hides it from the one who should.</p>
 */
export function useDefaultAssignee(enabled = true) {
  const { groups, options } = useAssignableByTeam(enabled);
  const currentUserId = useAuthStore(s => s.user?.id);

  return React.useMemo(() => {
    if (!currentUserId) return { value: "", needsTeamChoice: false };

    // Every group this user appears under = every team they belong to.
    const mine = groups.filter(g => g.members.some(m => m.id === currentUserId));

    if (mine.length === 1) {
      const opt = mine[0].members.find(m => m.id === currentUserId)!;
      return { value: encodeAssignee(opt.id, opt.teamId), needsTeamChoice: false };
    }

    // In several teams (or none): own it, but leave the team for them to choose.
    const self = options.find(o => o.id === currentUserId);
    return {
      value: self ? encodeAssignee(self.id, null) : "",
      needsTeamChoice: mine.length > 1,
    };
  }, [groups, options, currentUserId]);
}
