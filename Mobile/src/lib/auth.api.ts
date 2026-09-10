import { anonymousPost, API_BASE_URL } from "@/lib/api-client";
import type { AuthTokenDto } from "@/types/auth";

const BASE = "/api/auth";

export const authApi = {
  login: (email: string, password: string): Promise<AuthTokenDto> =>
    anonymousPost(`${BASE}/login`, { email, password }),

  /** Step 2 of a 2FA login -- submit the authenticator (or backup) code with the MFA token. */
  verifyTwoFactor: (mfaToken: string, code: string): Promise<AuthTokenDto> =>
    anonymousPost(`${BASE}/verify-2fa`, { mfaToken, code }),

  refresh: (token: string): Promise<AuthTokenDto> => anonymousPost(`${BASE}/refresh`, { token }),

  /** Revoke the refresh token (logout from this device). Best-effort -- local logout always wins. */
  revoke: async (refreshToken: string, accessToken: string): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}${BASE}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: refreshToken }),
      });
    } catch {
      // Server-side revoke failing must never block the local logout the user asked for.
    }
  },
};
