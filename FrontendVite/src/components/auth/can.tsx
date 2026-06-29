import * as React from "react";
import { useAuthStore } from "@/store/auth.store";

/**
 * Declarative permission gate. Renders children only when the current user has the given
 * raw permission key (e.g. "settings.users.edit"). Super/tenant admins always pass — see
 * `hasRawPermission` in the auth store, which also applies per-user grant/deny overrides.
 *
 * <Can permission="settings.users.edit"><Button>Edit</Button></Can>
 *
 * Pass `anyOf` to require ANY of several keys. Use `fallback` to render something when denied.
 */
export function Can({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hasRawPermission = useAuthStore(s => s.hasRawPermission);
  const keys = anyOf ?? (permission ? [permission] : []);
  const allowed = keys.length === 0 || keys.some(k => hasRawPermission(k));
  return <>{allowed ? children : fallback}</>;
}

/** Hook form of <Can> for use in conditionals/handlers. */
export function useCan(permission: string): boolean {
  return useAuthStore(s => s.hasRawPermission)(permission);
}
