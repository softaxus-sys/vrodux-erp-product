/**
 * Mirrors the fields FrontendVite/src/lib/identity/types.ts declares for
 * UserDto/AuthTokenDto -- trimmed to what the mobile app actually reads.
 * Keep in sync with the backend Identity service, not re-derived locally.
 */
export interface UserDto {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  avatarUrl: string | null;
  mustChangePassword?: boolean;
}

export interface AuthTokenDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  user: UserDto | null;
  /** True => no tokens issued yet, submit the authenticator/backup code via /auth/verify-2fa. */
  mfaRequired?: boolean;
  mfaToken?: string | null;
  /** Session IS valid; the tenant now requires 2FA and this account hasn't enrolled yet. */
  mustSetUpTwoFactor?: boolean;
}

/** Decoded from the JWT payload at login -- the same claims buildTenantFromClaims reads on web. */
export interface TenantClaims {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  country: string;
  /** Backend module keys, e.g. ["hr","crm","finance"] -- drives which screens/tabs render. */
  modules: string[];
  isSuperAdmin: boolean;
  subscriptionState?: string;
  trialDaysLeft?: number;
}
