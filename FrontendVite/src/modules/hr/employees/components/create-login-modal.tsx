import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { X, KeyRound, Copy, Check, AlertTriangle, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { usersApi } from "@/lib/identity/users.api";
import { useRoles } from "@/hooks/identity/use-roles";
import { useLinkEmployeeUser } from "@/hooks/hr/use-hr";
import type { EmployeeDto } from "@/lib/hr/hr.api";

interface Props {
  open: boolean;
  onClose: () => void;
  employee: EmployeeDto;
}

/**
 * Gives an employee portal access: creates the login, then links it to the employee record.
 *
 * <p>Two calls in sequence rather than one endpoint, deliberately. Identity owns logins and HR owns
 * employment records; HR must never write into the identity schema, so the orchestration lives
 * here — the same shape as the visa module creating a Finance invoice.</p>
 *
 * <p>The temporary password is generated on the server and returned exactly once. It is shown here
 * for the administrator to hand over, and cannot be retrieved again — only its hash is stored.</p>
 */
export function CreateLoginModal({ open, onClose, employee }: Props) {
  const { t } = useTranslation("hr");
  const { data: rolesData } = useRoles({ pageSize: 100 });
  const link = useLinkEmployeeUser();

  const [username, setUsername] = React.useState("");
  const [roleId, setRoleId]     = React.useState("");
  const [busy, setBusy]         = React.useState(false);
  const [sendInvite, setSendInvite] = React.useState(true);
  const [result, setResult]     = React.useState<
    { email: string; password: string | null; inviteSent: boolean; inviteError?: string | null } | null>(null);
  const [copied, setCopied]     = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);

  const roles = rolesData?.items ?? [];

  React.useEffect(() => {
    if (!open) { setResult(null); setCopied(false); setError(null); setBusy(false); setSendInvite(true); return; }
    setUsername(employee.email ? employee.email.split("@")[0] : "");
    // Default to the self-service role when the tenant has one — it is what an ordinary employee
    // needs, and picking anything wider by default would be a poor default to make.
    const self = roles.find(r => r.name.toLowerCase().startsWith("employee"));
    setRoleId(self?.id ?? "");
  }, [open, employee.email, rolesData]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const provisioned = await usersApi.provision({
        email:     employee.email,
        username:  username.trim(),
        firstName: employee.firstName || employee.fullName,
        lastName:  employee.lastName || "",
        roleIds:   roleId ? [roleId] : [],
        sendInvite,
      });

      // Link second: if this fails the login still exists, and the panel's "Find account" will
      // offer it — better than a login that cannot be created twice because of the email.
      await link.mutateAsync({ employeeId: employee.id, userId: provisioned.user.id });

      setResult({
        email:      employee.email,
        password:   provisioned.temporaryPassword,
        inviteSent: provisioned.inviteSent,
        inviteError: provisioned.inviteError,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result?.password) return;
    try {
      await navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("employees.login.copyFailed"));
    }
  };

  const canCreate = !!employee.email && username.trim().length > 0 && !busy;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={onClose} />
          {/* Flex-centred: Framer owns `transform` for the scale animation, which would overwrite
              Tailwind's translate-based centring. */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto w-[min(30rem,92vw)] bg-card border border-border rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="text-base font-bold">{t("employees.login.title")}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{employee.fullName}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>

              {result ? (
                <div className="p-6 space-y-4">
                  {result.inviteSent ? (
                    /* The good outcome: nobody but the employee ever learns the password. */
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-success/10 border border-success/30">
                        <MailCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <p className="text-xs text-success">
                          {t("employees.login.inviteSent", { email: result.email })}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t("employees.login.inviteHint")}</p>
                    </>
                  ) : (
                    <>
                      {/* Either the administrator chose to hand it over, or the invite could not
                          be sent — in both cases the password is the only way in, so it is shown
                          with the same "once only" warning. */}
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30">
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          {sendInvite ? t("employees.login.inviteFailed") : t("employees.login.shownOnce")}
                          {sendInvite && result.inviteError && (
                            <span className="block mt-1 opacity-80">{result.inviteError}</span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.login.signInWith")}</label>
                        <div className="h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm flex items-center font-mono">
                          {result.email}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.login.temporaryPassword")}</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-10 px-3 rounded-lg border border-border bg-muted/40 text-base flex items-center font-mono tracking-wider select-all">
                            {result.password}
                          </div>
                          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={copy}>
                            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground">{t("employees.login.mustChangeHint")}</p>
                    </>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={onClose}>{t("employees.login.done")}</Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {!employee.email && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{t("employees.login.needsEmail")}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.login.signInWith")}</label>
                    <div className="h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm flex items-center">
                      {employee.email || "—"}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.login.username")}</label>
                    <Input value={username} onChange={e => setUsername(e.target.value)} className="h-9 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.login.role")}</label>
                    <select value={roleId} onChange={e => setRoleId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("employees.login.noRole")}</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">{t("employees.login.roleHint")}</p>
                  </div>

                  {/* Delivery. Emailing a link is first and default because it is the only option
                      where nobody but the employee ever knows the password. The temporary password
                      exists for staff with no working mailbox, which is common for site and
                      retail employees — the whole reason this flow is separate from Create User. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("employees.login.delivery")}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input type="radio" className="mt-0.5 accent-primary" checked={sendInvite}
                          onChange={() => setSendInvite(true)} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <Mail className="h-3 w-3" />{t("employees.login.deliveryInvite")}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {t("employees.login.deliveryInviteHint")}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input type="radio" className="mt-0.5 accent-primary" checked={!sendInvite}
                          onChange={() => setSendInvite(false)} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <KeyRound className="h-3 w-3" />{t("employees.login.deliveryPassword")}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {t("employees.login.deliveryPasswordHint")}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>{t("employees.login.cancel")}</Button>
                    <Button onClick={create} disabled={!canCreate} className="gap-1.5">
                      {sendInvite ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                      {busy
                        ? t("employees.login.creating")
                        : sendInvite ? t("employees.login.createAndInvite") : t("employees.login.create")}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
