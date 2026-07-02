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
  user: UserDto;
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
  occurredOn: string;
}
