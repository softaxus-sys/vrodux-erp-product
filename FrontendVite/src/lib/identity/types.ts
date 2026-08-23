/**
 * TypeScript mirrors of the Identity microservice DTOs.
 * Kept as plain interfaces (no class or enum) so they can be used in both
 * client and server contexts.
 */

export interface PermissionDto {
  id: string;
  moduleId: string;
  action: string;
  description: string;
  key: string; // e.g. "pos.read"
}

export interface RoleDto {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionDto[];
}

export interface RoleSummaryDto {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  /** Module prefixes this role grants permissions in (e.g. ["pos","crm"]). */
  modules: string[];
}

/** A per-user permission override layered on top of role permissions. */
export interface PermissionOverrideDto {
  permissionId: string;
  key: string;          // e.g. "hr.payroll.approve"
  isGranted: boolean;   // true = extra grant, false = explicit deny
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  phoneNumber: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleDto[];
  permissionOverrides: PermissionOverrideDto[];
}

export interface UserSummaryDto {
  id: string;
  email: string;
  username: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  roleCount: number;
}

export interface AuthTokenDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  user: UserDto | null;
  /** When true, the account has 2FA enabled — no tokens issued yet; call verify-2fa with mfaToken. */
  mfaRequired?: boolean;
  mfaToken?: string | null;
}

// ── Two-factor authentication ─────────────────────────────────────────────────

export interface TwoFactorStatusDto {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface TwoFactorSetupDto {
  secret: string;
  otpAuthUri: string;
  qrCodeDataUri: string;
}

export interface TwoFactorEnableResultDto {
  backupCodes: string[];
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  succeeded: boolean;
  /** UTC ISO-8601 instant (always carries the trailing "Z" — see AuditLogDto on the backend). */
  occurredOn: string;
}

/** Stat counts over the whole filtered set, not just the current page. */
export interface AuditLogSummaryDto {
  total: number;
  failed: number;
  today: number;
}
