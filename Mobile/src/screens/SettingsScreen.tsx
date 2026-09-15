import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useChangePassword,
  useDisableTwoFactor,
  useEnableTwoFactor,
  useMe,
  useSetupTwoFactor,
  useTwoFactorStatus,
  useUpdateProfile,
} from "@/hooks/use-settings";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/auth.api";
import { unregisterPushAsync } from "@/lib/push";
import { useAuthStore } from "@/store/auth.store";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { TwoFactorSetupDto } from "@/types/settings";

/** "My Account" -- profile, password, and 2FA for the signed-in user. No permission gate, same
 *  as the backend endpoints it calls (see types/settings.ts's top-of-file note). The admin half
 *  of Settings (users/roles/branches/integrations/general company settings) is out of scope --
 *  real multi-field forms and permission-matrix editors, desktop-appropriate like every other
 *  module's admin surface. */
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await unregisterPushAsync();
    if (refreshToken && accessToken) {
      await authApi.revoke(refreshToken, accessToken);
    }
    logout();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ProfileSection />
      <ChangePasswordSection />
      <TwoFactorSection />
      <View style={styles.signOutRow}>
        <Button label="Sign out" variant="outline" icon="log-out" onPress={handleLogout} fullWidth />
      </View>
    </ScrollView>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const me = useMe();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    if (!me.data) return;
    setFirstName(me.data.firstName);
    setLastName(me.data.lastName);
    setPhoneNumber(me.data.phoneNumber ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    try {
      await update.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim(), phoneNumber: phoneNumber.trim() || null });
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your profile.");
    }
  }

  return (
    <SectionCard
      title="Profile"
      right={
        !editing && me.data ? (
          <Button label="Edit" size="sm" variant="ghost" onPress={startEditing} />
        ) : undefined
      }
    >
      {me.isLoading ? (
        <LoadingState size="small" />
      ) : me.isError ? (
        <ErrorState message="Couldn't load your profile." onRetry={() => me.refetch()} />
      ) : editing ? (
        <View style={styles.formGap}>
          <Field label="First name" value={firstName} onChangeText={setFirstName} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} />
          <Field label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actionsRow}>
            <Button label={update.isPending ? "Saving…" : "Save"} size="sm" disabled={update.isPending} onPress={save} />
            <Button label="Cancel" size="sm" variant="ghost" disabled={update.isPending} onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <>
          <DetailRow label="Name" value={me.data?.fullName ?? "—"} />
          <DetailRow label="Email" value={me.data?.email ?? "—"} />
          <DetailRow label="Username" value={me.data?.username ?? "—"} />
          <DetailRow label="Phone" value={me.data?.phoneNumber || "Not set"} />
        </>
      )}
    </SectionCard>
  );
}

// ── Change password ──────────────────────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length > 0 && !mismatch;

  async function submit() {
    setError(null);
    setDone(false);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDone(true);
      // The server enforces the tenant's own password policy (length/complexity/expiry) -- any
      // rejection surfaces through the catch below with its own message, not re-validated here.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't change your password.");
    }
  }

  return (
    <SectionCard title="Change Password">
      <View style={styles.formGap}>
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secure />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secure />
        <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secure />
        {mismatch ? <Text style={styles.errorText}>Passwords don&apos;t match.</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {done ? <Text style={styles.successText}>Password changed.</Text> : null}
        <Button label={changePassword.isPending ? "Saving…" : "Change Password"} disabled={!canSubmit || changePassword.isPending} onPress={submit} />
      </View>
    </SectionCard>
  );
}

// ── Two-factor authentication ────────────────────────────────────────────────────────────────

function TwoFactorSection() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const status = useTwoFactorStatus();
  const setup = useSetupTwoFactor();
  const enable = useEnableTwoFactor();
  const disable = useDisableTwoFactor();

  const [setupData, setSetupData] = useState<TwoFactorSetupDto | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setError(null);
    try {
      const data = await setup.mutateAsync();
      setSetupData(data);
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start 2FA setup.");
    }
  }

  async function confirmEnable() {
    setError(null);
    try {
      const result = await enable.mutateAsync(code.trim());
      setBackupCodes(result.backupCodes);
      setSetupData(null);
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work.");
    }
  }

  async function confirmDisable() {
    setError(null);
    try {
      await disable.mutateAsync(disableCode.trim());
      setDisabling(false);
      setDisableCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work.");
    }
  }

  return (
    <SectionCard title="Two-Factor Authentication">
      {status.isLoading ? (
        <LoadingState size="small" />
      ) : status.isError ? (
        <ErrorState message="Couldn't load 2FA status." onRetry={() => status.refetch()} />
      ) : backupCodes ? (
        <View style={styles.formGap}>
          <Text style={styles.bodyText}>
            2FA is enabled. Save these one-time backup codes somewhere safe — they&apos;re shown only once, and each
            covers a lost-device login.
          </Text>
          <View style={styles.codesBox}>
            {backupCodes.map((c) => (
              <Text key={c} style={styles.codeText} selectable>
                {c}
              </Text>
            ))}
          </View>
          <Button label="Done" onPress={() => setBackupCodes(null)} />
        </View>
      ) : setupData ? (
        <View style={styles.formGap}>
          <Text style={styles.bodyText}>Scan this QR code in an authenticator app (Google Authenticator, Authy, 1Password…), or enter the key manually:</Text>
          <Image source={{ uri: setupData.qrCodeDataUri }} style={styles.qrImage} resizeMode="contain" />
          <Text style={styles.secretText} selectable>
            {setupData.secret}
          </Text>
          <Field label="Enter the 6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actionsRow}>
            <Button label={enable.isPending ? "Confirming…" : "Confirm"} disabled={enable.isPending || code.trim().length === 0} onPress={confirmEnable} />
            <Button label="Cancel" variant="ghost" disabled={enable.isPending} onPress={() => setSetupData(null)} />
          </View>
        </View>
      ) : disabling ? (
        <View style={styles.formGap}>
          <Text style={styles.bodyText}>Enter a current authenticator or backup code to turn off 2FA.</Text>
          <Field label="Code" value={disableCode} onChangeText={setDisableCode} keyboardType="number-pad" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actionsRow}>
            <Button label={disable.isPending ? "Disabling…" : "Disable 2FA"} variant="destructive" disabled={disable.isPending || disableCode.trim().length === 0} onPress={confirmDisable} />
            <Button label="Cancel" variant="ghost" disabled={disable.isPending} onPress={() => setDisabling(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.formGap}>
          <View style={styles.statusRow}>
            <Badge label={status.data?.enabled ? "Enabled" : "Not enabled"} tone={status.data?.enabled ? "success" : "neutral"} />
            {status.data?.enabled ? (
              <Text style={styles.bodyText}>{status.data.backupCodesRemaining} backup codes remaining</Text>
            ) : null}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {status.data?.enabled ? (
            <Button label="Disable 2FA" variant="outline" onPress={() => setDisabling(true)} />
          ) : (
            <Button label={setup.isPending ? "Starting…" : "Enable 2FA"} disabled={setup.isPending} onPress={startSetup} />
          )}
        </View>
      )}
    </SectionCard>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: "phone-pad" | "number-pad";
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [hidden, setHidden] = useState(Boolean(secure));
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize="none"
          placeholderTextColor={colors.subtleForeground}
        />
        {secure ? (
          <Feather
            name={hidden ? "eye" : "eye-off"}
            size={16}
            color={colors.subtleForeground}
            onPress={() => setHidden((v) => !v)}
            style={styles.fieldEyeIcon}
          />
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    signOutRow: { marginTop: spacing.sm },

    formGap: { gap: spacing.sm },
    actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },

    fieldWrap: { gap: 4 },
    fieldLabel: { fontSize: fontSize.sm, color: colors.mutedForeground },
    fieldInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background },
    fieldInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground },
    fieldEyeIcon: { paddingHorizontal: spacing.md },

    bodyText: { fontSize: fontSize.base, color: colors.foreground },
    errorText: { fontSize: fontSize.sm, color: colors.destructive },
    successText: { fontSize: fontSize.sm, color: colors.success },

    statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },

    qrImage: { width: 200, height: 200, alignSelf: "center", backgroundColor: "#fff", borderRadius: radius.md },
    secretText: { fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: "center", letterSpacing: 1 },

    codesBox: { backgroundColor: colors.cardMuted, borderRadius: radius.md, padding: spacing.md, gap: 4 },
    codeText: { fontSize: fontSize.base, color: colors.foreground, letterSpacing: 1 },
  });
}
