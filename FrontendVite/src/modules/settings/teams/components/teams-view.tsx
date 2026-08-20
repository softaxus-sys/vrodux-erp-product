import * as React from "react";
import { useTranslation } from "react-i18next";
import { Users, Plus, Trash2, Pencil, Crown, X, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Can, useCan } from "@/components/auth/can";
import { useUsers } from "@/hooks/identity/use-users";
import {
  useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember,
  useTeamLeadCandidates,
} from "@/hooks/identity/use-teams";
import type { TeamDto } from "@/lib/identity/teams.api";

/**
 * Team management — the middle rung of admin → team lead → team member.
 *
 * A team's lead sees every lead assigned to any member (granted the `crm.leads-team.*` permissions),
 * so membership here is what actually drives CRM visibility.
 */
export function TeamsView() {
  const { t } = useTranslation("settings");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const { data: teams = [], isLoading } = useTeams(debounced || undefined);
  const canEdit = useCan("settings.users.edit");

  // Hold the id, not the object. The editor mutates membership through the API, so a captured
  // TeamDto goes stale the moment a member is added and the dialog would keep rendering the old
  // member list — which reads as "adding members does nothing".
  const [editingId, setEditingId] = React.useState<string | "new" | null>(null);
  const editing = editingId === "new" ? "new" : teams.find((x) => x.id === editingId) ?? null;
  const [confirmDelete, setConfirmDelete] = React.useState<TeamDto | null>(null);

  const del = useDeleteTeam();

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("teams.title", { defaultValue: "Teams" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("teams.subtitle", {
              defaultValue: "Group users under a team lead. A lead can see and reassign their members' leads.",
            })}
          </p>
        </div>
        <Can permission="settings.users.edit">
          <Button size="sm" onClick={() => setEditingId("new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t("teams.add", { defaultValue: "New Team" })}
          </Button>
        </Can>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("teams.searchPlaceholder", { defaultValue: "Search teams…" })}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          {t("teams.empty", { defaultValue: "No teams yet. Create one to set up the lead → member hierarchy." })}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {teams.map((team) => (
            <div key={team.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{team.name}</p>
                  {team.description && (
                    <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingId(team.id)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete(team)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <Crown className="h-3.5 w-3.5 text-warning shrink-0" />
                {team.teamLeadName ? (
                  <span className="text-foreground truncate">{team.teamLeadName}</span>
                ) : (
                  <span className="text-muted-foreground italic">
                    {t("teams.noLead", { defaultValue: "No lead assigned" })}
                  </span>
                )}
                {!team.isActive && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                    {t("teams.inactive", { defaultValue: "Inactive" })}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  {t("teams.memberCount", { defaultValue: "{{count}} member(s)", count: team.members.length })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {team.members.slice(0, 6).map((m) => (
                    <span
                      key={m.userId}
                      title={m.email}
                      className={cn(
                        "px-1.5 py-0.5 rounded-full text-[10px]",
                        m.isLead ? "bg-warning/10 text-warning font-semibold" : "bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {m.fullName || m.email}
                    </span>
                  ))}
                  {team.members.length > 6 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-muted/50 text-[10px] text-muted-foreground">
                      +{team.members.length - 6}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TeamEditor
          team={editing === "new" ? null : editing}
          onClose={() => setEditingId(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {t("teams.confirmTitle", { defaultValue: "Delete team?" })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("teams.confirmBody", {
                defaultValue: "“{{name}}” will be removed. Its members keep their own leads; the lead loses team-wide visibility.",
                name: confirmDelete.name,
              })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                {t("common:action.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={del.isPending}
                onClick={() => del.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
              >
                {del.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {t("teams.delete", { defaultValue: "Delete" })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Create/edit a team, pick its lead, and manage membership. */
function TeamEditor({ team, onClose }: { team: TeamDto | null; onClose: () => void }) {
  const { t } = useTranslation("settings");
  const isNew = team === null;

  const { data: usersPage } = useUsers({ pageSize: 200 });
  const users = React.useMemo(
    () => (usersPage?.items ?? []).filter((u) => u.status?.toLowerCase() === "active"),
    [usersPage],
  );

  // Only users who hold the CRM team tier can lead — offering anyone else would create a lead who
  // sees none of their team's records.
  const { data: leadCandidates = [] } = useTeamLeadCandidates();

  const create = useCreateTeam();
  const update = useUpdateTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const [name, setName] = React.useState(team?.name ?? "");
  const [description, setDescription] = React.useState(team?.description ?? "");
  const [leadId, setLeadId] = React.useState(team?.teamLeadUserId ?? "");
  const [isActive, setIsActive] = React.useState(team?.isActive ?? true);
  // Only used while creating — an existing team's membership is edited row by row against the API.
  const [pendingMembers, setPendingMembers] = React.useState<string[]>([]);

  const busy = create.isPending || update.isPending;

  const save = () => {
    if (!name.trim()) return;
    if (isNew) {
      create.mutate(
        {
          name: name.trim(),
          description: description.trim() || null,
          teamLeadUserId: leadId || null,
          memberUserIds: pendingMembers,
        },
        { onSuccess: onClose },
      );
    } else {
      update.mutate(
        { id: team!.id, name: name.trim(), description: description.trim() || null, teamLeadUserId: leadId || null, isActive },
        { onSuccess: onClose },
      );
    }
  };

  const currentMemberIds = new Set(isNew ? pendingMembers : team!.members.map((m) => m.userId));
  const selectableUsers = users.filter((u) => !currentMemberIds.has(u.id));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {t(isNew ? "teams.addTitle" : "teams.editTitle", { defaultValue: isNew ? "New Team" : "Edit Team" })}
          </p>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("teams.name", { defaultValue: "Team name" })}
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("teams.description", { defaultValue: "Description (optional)" })}
          </label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-sm" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("teams.lead", { defaultValue: "Team lead" })}
          </label>
          <select
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm"
          >
            <option value="">{t("teams.noLeadOption", { defaultValue: "No lead" })}</option>
            {leadCandidates.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
            {/* An existing lead who has since lost the permission would otherwise vanish from the
                list and be silently cleared on the next save. */}
            {leadId && !leadCandidates.some((u) => u.userId === leadId) && (
              <option value={leadId}>{team?.teamLeadName ?? leadId}</option>
            )}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {leadCandidates.length === 0
              ? t("teams.noLeadCandidates", {
                  defaultValue: "No user holds the team tier yet. Grant a role crm.leads-team.view / .edit to make them eligible.",
                })
              : t("teams.leadHint", {
                  defaultValue: "Only users granted the team tier (crm.leads-team.view / .edit) are listed.",
                })}
          </p>
        </div>

        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            {t("teams.active", { defaultValue: "Active" })}
          </label>
        )}

        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("teams.members", { defaultValue: "Members" })}
          </p>

          {/* Existing teams update membership immediately; a new team stages members until saved. */}
          {!isNew && team!.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 text-sm">
              {m.isLead && <Crown className="h-3.5 w-3.5 text-warning shrink-0" />}
              <span className="flex-1 truncate text-foreground">{m.fullName || m.email}</span>
              <button
                disabled={m.isLead || removeMember.isPending}
                title={m.isLead ? t("teams.cannotRemoveLead", { defaultValue: "Change the lead before removing them" }) : undefined}
                onClick={() => removeMember.mutate({ teamId: team!.id, userId: m.userId })}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {isNew && pendingMembers.map((id) => {
            const u = users.find((x) => x.id === id);
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate text-foreground">{u?.fullName ?? id}</span>
                <button onClick={() => setPendingMembers((p) => p.filter((x) => x !== id))}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {/* Picking a name commits it straight away. The previous select + "+" pairing read as a
              finished action once a name was showing, so members were routinely never actually added. */}
          <select
            value=""
            disabled={addMember.isPending || selectableUsers.length === 0}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              if (isNew) setPendingMembers((prev) => [...prev, id]);
              else addMember.mutate({ teamId: team!.id, userId: id });
            }}
            className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {selectableUsers.length === 0
                ? t("teams.everyoneAdded", { defaultValue: "Everyone is already on this team" })
                : t("teams.addMember", { defaultValue: "Add a member…" })}
            </option>
            {selectableUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common:action.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button size="sm" disabled={!name.trim() || busy} onClick={save}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {t("common:action.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
