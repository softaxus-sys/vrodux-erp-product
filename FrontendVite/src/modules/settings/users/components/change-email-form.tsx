import * as React from "react";
import { useTranslation } from "react-i18next";
import { Mail, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangeUserEmail } from "@/hooks/identity/use-users";

interface ChangeEmailFormProps {
  userId: string;
  currentEmail: string;
  /**
   * True when the signed-in user is changing their OWN address. Drives both the password field
   * (the server requires it for a self-change) and the warning, since the consequences differ:
   * a self-change signs you out and holds the account until the new address is verified.
   */
  isSelf: boolean;
  onCancel?: () => void;
  onChanged?: (newEmail: string) => void;
}

/**
 * Shared by the admin user editor and the user's own profile — one implementation, so the rules
 * (and the warnings about them) cannot drift between the two places an address can be changed.
 */
export function ChangeEmailForm({
  userId, currentEmail, isSelf, onCancel, onChanged,
}: ChangeEmailFormProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [newEmail, setNewEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const changeEmail = useChangeUserEmail(userId);

  const trimmed  = newEmail.trim();
  const isSame   = trimmed.toLowerCase() === currentEmail.trim().toLowerCase();
  // Deliberately loose: the server's Email value object is the authority, this only stops an
  // obviously-empty submit.
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const canSubmit = looksValid && !isSame && (!isSelf || password.length > 0) && !changeEmail.isPending;

  const submit = () => {
    if (!canSubmit) return;
    changeEmail.mutate(
      { newEmail: trimmed, currentPassword: isSelf ? password : undefined },
      {
        onSuccess: () => {
          setNewEmail(""); setPassword("");
          onChanged?.(trimmed);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("users.changeEmail.newLabel")}
        </label>
        <Input
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder={t("users.changeEmail.newPlaceholder")}
          className="h-9 text-sm"
          autoFocus
        />
        {isSame && trimmed.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{t("users.changeEmail.same")}</p>
        )}
      </div>

      {isSelf && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("users.changeEmail.passwordLabel")}
          </label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            placeholder={t("users.changeEmail.passwordPlaceholder")}
            className="h-9 text-sm"
          />
        </div>
      )}

      {/* State the consequences before the click, not after. */}
      <div className="flex gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {isSelf ? t("users.changeEmail.warnSelf") : t("users.changeEmail.warnOther")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 gap-1.5" onClick={submit} disabled={!canSubmit}>
          {changeEmail.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{tc("action.saving")}</>
            : <><Mail className="h-3.5 w-3.5" />{t("users.changeEmail.submit")}</>}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={changeEmail.isPending}>
            {tc("action.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
