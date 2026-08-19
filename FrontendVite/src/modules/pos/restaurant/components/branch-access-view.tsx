import * as React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Search, Plus, Trash2, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBranches } from "@/hooks/identity/use-branches";
import { useUserBranches, useAddUserBranch, useUpdateUserBranchRole, useRemoveUserBranch } from "@/hooks/restaurant/use-user-branches";
import type { BranchRole, UserBranchDto } from "@/lib/restaurant/user-branches.api";
import { usersApi } from "@/lib/identity/users.api";
import type { UserSummaryDto } from "@/lib/identity/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/can";

/** Enum values kept English for the API; labels come from i18n (branchAccess.role.*). */
const ROLE_OPTIONS: BranchRole[] = ["owner", "manager", "staff"];

export function BranchAccessView() {
  const { t } = useTranslation("restaurant");
  const canEdit = useCan("restaurant.branches.edit");
  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const { data: assignments = [] } = useUserBranches();
  const [selectedBranchId, setSelectedBranchId] = React.useState<string | null>(null);

  if (!canEdit) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">{t("branchAccess.noPermission")}</p></div>;
  }

  React.useEffect(() => {
    if (!selectedBranchId && branches.length > 0) setSelectedBranchId(branches[0].id);
  }, [branches, selectedBranchId]);

  const countFor = (branchId: string) => assignments.filter(a => a.branchId === branchId).length;
  const selectedBranch = branches.find(b => b.id === selectedBranchId) ?? null;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> {t("branchAccess.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("branchAccess.description")}
        </p>
      </div>

      {branchesLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> {t("branchAccess.loading")}</div>
      ) : branches.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">{t("branchAccess.noBranches")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          <div className="space-y-1.5">
            {branches.map(b => (
              <button key={b.id} onClick={() => setSelectedBranchId(b.id)}
                className={cn("w-full text-left px-3 py-2.5 rounded-lg border flex items-center justify-between gap-2",
                  selectedBranchId === b.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20")}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.code}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Users className="w-3 h-3" /> {countFor(b.id)}
                </span>
              </button>
            ))}
          </div>

          {selectedBranch && <BranchRoster branchId={selectedBranch.id} branchName={selectedBranch.name} assignments={assignments.filter(a => a.branchId === selectedBranch.id)} />}
        </div>
      )}
    </div>
  );
}

function BranchRoster({ branchId, branchName, assignments }: { branchId: string; branchName: string; assignments: UserBranchDto[] }) {
  const { t } = useTranslation("restaurant");
  const addUserBranch = useAddUserBranch();
  const updateRole = useUpdateUserBranchRole();
  const removeUserBranch = useRemoveUserBranch();

  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<UserSummaryDto[]>([]);
  const [searching, setSearching] = React.useState(false);

  const assignedUserIds = new Set(assignments.map(a => a.userId));

  React.useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      usersApi.getAll({ search: search.trim(), pageSize: 8 })
        .then(res => { if (active) setSearchResults(res.items.filter(u => !assignedUserIds.has(u.id))); })
        .catch(() => { if (active) setSearchResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, assignments.length]);

  const handleAdd = async (user: UserSummaryDto) => {
    try {
      await addUserBranch.mutateAsync({ userId: user.id, userName: user.fullName || user.username, branchId, role: "staff" });
      setSearch(""); setSearchResults([]);
    } catch { /* hook toasts */ }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-foreground">{t("branchAccess.roster", { branch: branchName })}</p>

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("branchAccess.emptyRoster")}</p>
      ) : (
        <div className="space-y-1.5">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-muted/20 border border-border rounded-lg px-3 py-2">
              <p className="text-sm font-medium flex-1 truncate">{a.userName}</p>
              <select value={a.role} onChange={e => updateRole.mutate({ id: a.id, role: e.target.value as BranchRole })}
                disabled={updateRole.isPending} className="h-8 text-xs rounded-md border border-border bg-card px-2">
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{t(`branchAccess.role.${r}`)}</option>)}
              </select>
              <button onClick={() => removeUserBranch.mutate(a.id)} disabled={removeUserBranch.isPending}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={t("branchAccess.searchUsers")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        {searching && <div className="flex items-center justify-center py-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>}
        {!searching && searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map(u => (
              <button key={u.id} onClick={() => handleAdd(u)} disabled={addUserBranch.isPending}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.fullName || u.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
        {!searching && search.trim() && searchResults.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">{t("branchAccess.noMatches")}</p>
        )}
      </div>
    </div>
  );
}
