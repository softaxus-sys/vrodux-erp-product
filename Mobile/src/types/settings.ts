/**
 * "My Account" -- the signed-in user's own profile, password, and two-factor authentication.
 * Deliberately not the admin-facing half of Settings (users/roles/branches/integrations/general
 * company settings) -- those are real multi-field forms and permission-matrix editors, desktop-
 * appropriate the same way every other module's admin surface has been left out of this app.
 * Every endpoint here is `/api/auth/me*` or `/api/account/2fa/*` -- the caller's own account, no
 * permission key required (confirmed by reading AuthController/TwoFactorController directly:
 * `[Authorize]` only, and App.tsx's own routing comment: "2FA is the signed-in user's own
 * account, so it needs no permission at all").
 */

export interface UpdateMeRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
}

export interface ChangeMyPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorStatusDto {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface TwoFactorSetupDto {
  secret: string;
  otpAuthUri: string;
  /** `data:image/png;base64,...` -- rendered directly via <Image source={{ uri }}>. */
  qrCodeDataUri: string;
}

export interface TwoFactorEnableResultDto {
  /** Plaintext, shown exactly once -- the caller must persist these somewhere on enrollment. */
  backupCodes: string[];
}
