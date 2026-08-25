import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Link2, Link2Off, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { hrApi, type EmployeeDto, type UserMatchDto } from "@/lib/hr/hr.api";
import { useLinkEmployeeUser, useUnlinkEmployeeUser } from "@/hooks/hr/use-hr";
import { useCan } from "@/components/auth/can";
import { usersApi } from "@/lib/identity/users.api";
import { toast } from "sonner";
import { CreateLoginModal } from "./create-login-modal";

/**
 * The employee's Vrodux login, if they have one.
 *
 * A User is a login; an Employee is a job. They are two records about one person, joined by an
 * explicit link — never merged, and never joined on email. Email is used once, to *suggest* a
 * candidate; the link itself is stored by id, so it survives an email change and can never
 * silently attach two people who happen to share an address.
 *
 * Plenty of employees legitimately have no login (site staff, drivers), and a login also consumes
 * a plan seat — so "not linked" is a normal state, not a warning.
 */
export function LinkedAccountPanel({ emp }: { emp: EmployeeDto }) {
  const { t } = useTranslation("hr");
  const link = useLinkEmployeeUser();
  const unlink = useUnlinkEmployeeUser();
  const canEdit = useCan("hr.employees.edit");

  const [match, setMatch] = React.useState<UserMatchDto | null>(null);
  const [searched, setSearched] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [confirmUnlink, setConfirmUnlink] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  // Creating a login mints a real account and consumes a plan seat, so it needs more than the
  // permission to edit an employee. HR holds its own key for this so giving an employee portal
  // access never requires the ability to create arbitrary users.
  const canCreateLogin = useCan("hr.employees.create-login") || useCan("settings.users.create");
  const [grantHrAccess, setGrantHrAccess] = React.useState(true);
  const [linking, setLinking] = React.useState(false);

  const account = emp.linkedAccount;

  // Looks for a login with the same address. Deliberately on demand rather than on render: it is a
  // suggestion the user asks for, and nothing is linked until they confirm.
  const findMatch = async () => {
    if (!emp.email) return;
    setSearching(true);
    try {
      setMatch(await hrApi.findUserMatch(emp.email));
    } catch {
      setMatch(null);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  /**
   * Links an existing login to this employee, and — when asked — also gives it HR self-service
   * access.
   *
   * The grant is a second call because Identity owns roles and HR owns employment records; HR
   * must never write into the identity schema. Order matters: the link is what the user came for,
   * so it goes first and the grant is best-effort. A failed grant leaves a correct link and a
   * toast, not a half-finished action the user has to guess at.
   */
  const linkExisting = async (m: UserMatchDto) => {
    setLinking(true);
    try {
      await link.mutateAsync({ employeeId: emp.id, userId: m.userId });
      if (grantHrAccess) {
        try {
          await usersApi.grantSelfService(m.userId);
          toast.success(t("employees.drawer.grantedSelfService"));
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
    } catch {
      // The link mutation surfaces its own error toast.
    } finally {
      setLinking(false);
    }
  };

  if (account) {
    const active = account.status?.toLowerCase() === "active";
    return (
      <div className="bg-muted/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{account.fullName || account.username}</p>
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1",
                active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
              )}>
                {active ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {account.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{account.email}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {account.lastLoginAt
                ? t("employees.drawer.lastSignIn", { date: formatDate(account.lastLoginAt, "medium") })
                : t("employees.drawer.neverSignedIn")}
            </p>
          </div>
          {canEdit && (
            confirmUnlink ? (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="destructive" className="h-7 text-xs"
                  disabled={unlink.isPending}
                  onClick={() => { unlink.mutate(emp.id); setConfirmUnlink(false); }}>
                  {t("employees.drawer.unlink")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => setConfirmUnlink(false)}>
                  {t("employees.drawer.cancel")}
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmUnlink(true)}
                title={t("employees.drawer.unlink")}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Link2Off className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        {/* Identity owns these fields — HR shows them, never copies them. */}
        <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
          {t("employees.drawer.accountOwnedByIdentity")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t("employees.drawer.noLinkedAccount")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("employees.drawer.noLinkedAccountHint")}</p>
        </div>
        {/* Search first, always. Creating a login is only offered once we know no account
            exists for this address — otherwise the create would fail on the taken email, or
            worse, produce a second account for someone who already has one. */}
        {canEdit && !searched && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0"
            onClick={findMatch} disabled={searching || !emp.email}>
            <Link2 className="h-3 w-3" />
            {searching ? t("employees.drawer.searching") : t("employees.drawer.findAccount")}
          </Button>
        )}
      </div>
      <AnimatePresence>
        {searched && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-border/50">
              {!match ? (
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-xs text-muted-foreground">
                    {t("employees.drawer.noMatchFound", { email: emp.email })}
                  </p>
                  {canCreateLogin && (
                    <Button size="sm" className="h-7 text-xs gap-1.5 shrink-0"
                      onClick={() => setShowCreate(true)} disabled={!emp.email}>
                      <KeyRound className="h-3 w-3" />
                      {t("employees.drawer.createLogin")}
                    </Button>
                  )}
                </div>
              ) : match.registeredInAnotherWorkspace ? (
                // Neither linkable nor creatable: a Vrodux login is identified by email across the
                // whole platform. Said plainly here so the create is never offered only to fail.
                <p className="text-xs text-warning">
                  {t("employees.drawer.matchOtherWorkspace", { email: emp.email })}
                </p>
              ) : match.alreadyLinkedToEmployeeName ? (
                // Reported, not offered — the unique index would reject it, and the user
                // deserves to know which employee already holds it.
                <p className="text-xs text-warning">
                  {t("employees.drawer.matchTaken", {
                    email: match.email,
                    name: match.alreadyLinkedToEmployeeName,
                  })}
                </p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{match.fullName || match.username}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{match.email} · {match.status}</p>
                    </div>
                    <Button size="sm" className="h-7 text-xs shrink-0" disabled={linking}
                      onClick={() => linkExisting(match)}>
                      {linking ? t("employees.drawer.linking") : t("employees.drawer.linkAccount")}
                    </Button>
                  </div>
                  {/* Linking by itself grants nothing — this login may exist for an entirely
                      different job. Stated as an explicit choice rather than done silently,
                      because it widens a real person's access. */}
                  {canCreateLogin && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 accent-primary"
                        checked={grantHrAccess} onChange={e => setGrantHrAccess(e.target.checked)} />
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {t("employees.drawer.grantSelfService")}
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateLoginModal open={showCreate} onClose={() => setShowCreate(false)} employee={emp} />
    </div>
  );
}
