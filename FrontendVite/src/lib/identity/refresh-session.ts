import { authApi } from "./auth.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Re-issue the session's access token from the stored refresh token.
 *
 * Why this exists: a large part of the tenant's configuration is embedded in the JWT as
 * claims — `currency`, `modules`, `plan`, `subscription_state`, `permission` — and those
 * claims are baked in at sign-in. The backend reads them per request (`TenantAmbient`),
 * so changing one of those settings has NO effect on the server until a new token is
 * minted, no matter what the client patches into its own store.
 *
 * The operating currency was the case that made this visible: Settings → General wrote
 * the new currency to the tenant and patched the auth store, so every screen *rendered*
 * the new currency — but the backend kept stamping newly created records (quotations,
 * invoices, deals) with the currency from the stale claim. The record then displayed its
 * own stored code, so a quotation composed in USD came back as AED.
 *
 * `POST /auth/refresh` rebuilds the claims from the tenant row, and it rotates the
 * refresh token, so the new one must be stored — `loginFromApi` does both.
 *
 * Best-effort by design: the caller's setting has already been persisted, so a failed
 * refresh must not be reported as a failed save. It just means the claims catch up at
 * the next sign-in.
 *
 * @returns true when the session was re-issued.
 */
export async function refreshSession(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const res = await authApi.refresh(refreshToken);
    if (!res?.accessToken || !res.user) return false;
    useAuthStore.getState().loginFromApi(res.accessToken, res.refreshToken, res.user);
    return true;
  } catch {
    return false;
  }
}
